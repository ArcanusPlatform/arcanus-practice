import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSV Processor Service
 * Handles parsing and validation of CDS CSV files
 */
export class CSVProcessor {
  headerFieldNames = {
    mrn: ['MRN', 'mrn', 'movement_reference_number', 'declaration_mrn'],
    entry_number: ['Entry Number', 'entry_number', 'EntryNumber'],
    acceptance_date: ['Acceptance Date', 'acceptance_date', 'AcceptanceDate', 'Accepted Date', 'accepted_date'],
    declaration_type: ['Declaration Type', 'declaration_type', 'DeclarationType', 'type', 'dec_type'],
    trader_eori: ['Trader EORI', 'trader_eori', 'TraderEORI', 'EORI', 'eori'],
    importer_eori: ['Importer EORI', 'importer_eori', 'ImporterEORI'],
    consignee_name: ['Consignee Name', 'consignee_name', 'ConsigneeName', 'Trader Name', 'trader_name'],
    consignor_name: ['Consignor Name', 'consignor_name', 'ConsignorName'],
    incoterm: ['Incoterm', 'incoterm', 'Inco Term', 'inco_term'],
    procedure_code: ['Procedure Code', 'procedure_code', 'ProcedureCode'],
    previous_procedure_code: ['Previous Procedure Code', 'previous_procedure_code', 'PreviousProcedureCode'],
    total_duty_paid: ['Total Duty Paid', 'total_duty_paid', 'TotalDutyPaid', 'total_duty'],
    total_vat_paid: ['Total VAT Paid', 'total_vat_paid', 'TotalVATPaid', 'total_vat'],
    total_excise_paid: ['Total Excise Paid', 'total_excise_paid', 'TotalExcisePaid', 'total_excise']
  };

  itemFieldNames = {
    declaration_mrn: ['MRN', 'mrn', 'movement_reference_number', 'declaration_mrn'],
    item_number: ['Item Number', 'item_number', 'ItemNumber', 'item_no', 'line_number'],
    commodity_code: ['Commodity Code', 'commodity_code', 'CommodityCode', 'hs_code', 'tariff_code'],
    description: ['Description', 'description', 'Goods Description', 'goods_description', 'item_description'],
    origin_country: ['Origin Country', 'origin_country', 'OriginCountry', 'country_of_origin', 'origin'],
    gross_mass: ['Gross Mass', 'gross_mass', 'GrossMass', 'gross_weight'],
    net_mass: ['Net Mass', 'net_mass', 'NetMass', 'net_weight', 'weight_kg'],
    quantity: ['Quantity', 'quantity', 'Supplementary Units', 'supplementary_units', 'units'],
    invoice_value: ['Invoice Value', 'invoice_value', 'InvoiceValue', 'invoice_amount', 'item_invoice_value'],
    invoice_currency: ['Invoice Currency', 'invoice_currency', 'InvoiceCurrency', 'currency'],
    procedure_code: ['Procedure Code', 'procedure_code', 'ProcedureCode']
  };

  taxFieldNames = {
    declaration_mrn: ['MRN', 'mrn', 'movement_reference_number', 'declaration_mrn'],
    item_number: ['Item Number', 'item_number', 'ItemNumber', 'item_no', 'line_number'],
    tax_type: ['Tax Type', 'tax_type', 'TaxType', 'duty_type', 'charge_type'],
    tax_base: ['Tax Base', 'tax_base', 'TaxBase', 'taxable_amount', 'base_amount'],
    tax_rate: ['Tax Rate', 'tax_rate', 'TaxRate', 'rate', 'duty_rate'],
    tax_amount: ['Tax Amount', 'tax_amount', 'TaxAmount', 'duty_amount', 'charge_amount'],
    calculation_method: ['Calculation Method', 'calculation_method', 'CalculationMethod']
  };

  /**
   * Process uploaded CSV files
   */
  async processFiles(files, userId) {
    const errors = [];
    const warnings = [];
    
    // Parse header file (required)
    const headerContent = await fs.readFile(files.header, 'utf-8');
    const headerRecords = parse(headerContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    const declarations = headerRecords.map((record, index) => {
      const declaration = this.parseHeaderRecord(record, userId, index + 2);
      
      // Validate MRN
      if (!this.isValidMRN(declaration.mrn)) {
        errors.push({
          scope: 'HEADER',
          identifier: declaration.mrn || 'UNKNOWN',
          message: 'Invalid MRN format (expected: YYGBxxxxxxxxxxxxxxxxx)',
          row: index + 2
        });
      }

      // Validate EORI
      if (!this.isValidEORI(declaration.trader_eori)) {
        warnings.push({
          scope: 'HEADER',
          identifier: declaration.mrn,
          message: 'Invalid EORI format',
          row: index + 2
        });
      }

      // Validate date
      if (!this.isValidDate(declaration.acceptance_date)) {
        errors.push({
          scope: 'HEADER',
          identifier: declaration.mrn,
          message: 'Invalid acceptance date format (expected: YYYY-MM-DD)',
          row: index + 2
        });
      }

      return declaration;
    });

    // Parse items file if provided
    let items = [];
    if (files.items) {
      const itemsContent = await fs.readFile(files.items, 'utf-8');
      const itemsRecords = parse(itemsContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
      
      items = itemsRecords.map((record, index) => {
        const item = this.parseItemRecord(record, index + 2);
        
        // Validate commodity code
        if (item.commodity_code && !this.isValidCommodityCode(item.commodity_code)) {
          warnings.push({
            scope: 'ITEMS',
            identifier: `${item.declaration_mrn}-${item.item_number}`,
            message: 'Invalid commodity code format (expected: 10 digits)',
            row: index + 2
          });
        }
        
        return item;
      });
    }

    // Parse tax file if provided
    let taxLines = [];
    if (files.tax) {
      const taxContent = await fs.readFile(files.tax, 'utf-8');
      const taxRecords = parse(taxContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
      
      taxLines = taxRecords.map((record, index) => this.parseTaxRecord(record, index + 2));
    }

    return {
      declarations,
      items,
      taxLines,
      errors,
      warnings
    };
  }

  /**
   * Parse header record
   */
  parseHeaderRecord(record, userId, rowNumber) {
    return {
      id: uuidv4(),
      user_id: userId,
      mrn: this.getField(record, this.headerFieldNames.mrn),
      entry_number: this.getField(record, this.headerFieldNames.entry_number),
      acceptance_date: this.getField(record, this.headerFieldNames.acceptance_date),
      declaration_type: this.getField(record, this.headerFieldNames.declaration_type) || 'IM4',
      trader_eori: this.getField(record, this.headerFieldNames.trader_eori),
      importer_eori: this.getField(record, this.headerFieldNames.importer_eori),
      consignee_name: this.getField(record, this.headerFieldNames.consignee_name),
      consignor_name: this.getField(record, this.headerFieldNames.consignor_name),
      incoterm: this.getField(record, this.headerFieldNames.incoterm),
      procedure_code: this.getField(record, this.headerFieldNames.procedure_code),
      previous_procedure_code: this.getField(record, this.headerFieldNames.previous_procedure_code),
      total_duty_paid: this.parseFloat(this.getField(record, this.headerFieldNames.total_duty_paid)),
      total_vat_paid: this.parseFloat(this.getField(record, this.headerFieldNames.total_vat_paid)),
      total_excise_paid: this.parseFloat(this.getField(record, this.headerFieldNames.total_excise_paid)),
      total_taxes_paid: 0,
      status: 'accepted',
      declaration_source: 'csv',
      raw_data: this.buildRawData(record, 'header', rowNumber, this.headerFieldNames),
      source_columns: Object.keys(record),
      unmapped_fields: this.getUnmappedFields(record, this.headerFieldNames)
    };
  }

  /**
   * Parse item record
   */
  parseItemRecord(record, rowNumber) {
    return {
      id: uuidv4(),
      declaration_mrn: this.getField(record, this.itemFieldNames.declaration_mrn),
      item_number: this.parseInt(this.getField(record, this.itemFieldNames.item_number)),
      commodity_code: this.getField(record, this.itemFieldNames.commodity_code),
      description: this.getField(record, this.itemFieldNames.description),
      origin_country: this.getField(record, this.itemFieldNames.origin_country),
      gross_mass: this.parseFloat(this.getField(record, this.itemFieldNames.gross_mass)),
      net_mass: this.parseFloat(this.getField(record, this.itemFieldNames.net_mass)),
      quantity: this.parseFloat(this.getField(record, this.itemFieldNames.quantity)),
      invoice_value: this.parseFloat(this.getField(record, this.itemFieldNames.invoice_value)),
      invoice_currency: this.getField(record, this.itemFieldNames.invoice_currency) || 'GBP',
      procedure_code: this.getField(record, this.itemFieldNames.procedure_code),
      raw_data: this.buildRawData(record, 'item', rowNumber, this.itemFieldNames),
      source_columns: Object.keys(record),
      unmapped_fields: this.getUnmappedFields(record, this.itemFieldNames)
    };
  }

  /**
   * Parse tax record
   */
  parseTaxRecord(record, rowNumber) {
    return {
      id: uuidv4(),
      declaration_mrn: this.getField(record, this.taxFieldNames.declaration_mrn),
      item_number: this.parseInt(this.getField(record, this.taxFieldNames.item_number)),
      tax_type: this.getField(record, this.taxFieldNames.tax_type),
      tax_base: this.parseFloat(this.getField(record, this.taxFieldNames.tax_base)),
      tax_rate: this.parseFloat(this.getField(record, this.taxFieldNames.tax_rate)),
      tax_amount: this.parseFloat(this.getField(record, this.taxFieldNames.tax_amount)),
      calculation_method: this.getField(record, this.taxFieldNames.calculation_method) || 'ad_valorem',
      raw_data: this.buildRawData(record, 'tax', rowNumber, this.taxFieldNames),
      source_columns: Object.keys(record),
      unmapped_fields: this.getUnmappedFields(record, this.taxFieldNames)
    };
  }

  /**
   * Get field value with multiple possible names
   */
  getField(record, possibleNames) {
    const normalizedRecord = this.getNormalizedRecord(record);
    for (const name of possibleNames) {
      const directValue = record[name];
      if (directValue !== undefined && directValue !== null && directValue !== '') {
        return directValue;
      }

      const normalizedValue = normalizedRecord.get(this.normalizeFieldName(name));
      if (normalizedValue !== undefined && normalizedValue !== null && normalizedValue !== '') {
        return normalizedValue;
      }
    }
    return null;
  }

  /**
   * Preserve the complete source row while recording which fields were normalized.
   */
  buildRawData(record, recordType, rowNumber, fieldNames) {
    const recognizedFields = {};
    for (const [field, aliases] of Object.entries(fieldNames)) {
      const matchedColumn = this.findMatchedColumn(record, aliases);
      if (matchedColumn) {
        recognizedFields[field] = {
          source_column: matchedColumn,
          value: record[matchedColumn]
        };
      }
    }

    return {
      record_type: recordType,
      row_number: rowNumber,
      fields: { ...record },
      recognized_fields: recognizedFields,
      unmapped_fields: this.getUnmappedFields(record, fieldNames)
    };
  }

  getUnmappedFields(record, fieldNames) {
    const recognizedColumns = new Set();
    for (const aliases of Object.values(fieldNames)) {
      const matchedColumn = this.findMatchedColumn(record, aliases);
      if (matchedColumn) recognizedColumns.add(matchedColumn);
    }

    return Object.keys(record).filter((column) => !recognizedColumns.has(column));
  }

  findMatchedColumn(record, possibleNames) {
    const normalizedColumns = new Map();
    for (const column of Object.keys(record)) {
      normalizedColumns.set(this.normalizeFieldName(column), column);
    }

    for (const name of possibleNames) {
      if (Object.prototype.hasOwnProperty.call(record, name)) {
        return name;
      }

      const normalizedColumn = normalizedColumns.get(this.normalizeFieldName(name));
      if (normalizedColumn) {
        return normalizedColumn;
      }
    }

    return null;
  }

  getNormalizedRecord(record) {
    const normalizedRecord = new Map();
    for (const [key, value] of Object.entries(record)) {
      normalizedRecord.set(this.normalizeFieldName(key), value);
    }
    return normalizedRecord;
  }

  normalizeFieldName(name) {
    return String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Parse float safely
   */
  parseFloat(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse int safely
   */
  parseInt(value) {
    if (value === null || value === undefined || value === '') return 1;
    const parsed = parseInt(String(value));
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Validate MRN format
   */
  isValidMRN(mrn) {
    if (!mrn) return false;
    // MRN format: YYGBxxxxxxxxxxxxxxxxx (2 digit year + GB + 15 alphanumeric)
    const mrnRegex = /^\d{2}GB[A-Z0-9]{15}$/i;
    return mrnRegex.test(mrn);
  }

  /**
   * Validate EORI format
   */
  isValidEORI(eori) {
    if (!eori) return false;
    // UK EORI: GB + 12 digits or GB + 15 alphanumeric
    const eoriRegex = /^GB\d{12}$|^GB[A-Z0-9]{15}$/i;
    return eoriRegex.test(eori);
  }

  /**
   * Validate commodity code
   */
  isValidCommodityCode(code) {
    if (!code) return false;
    // 10-digit HS code
    return /^\d{10}$/.test(code);
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}
