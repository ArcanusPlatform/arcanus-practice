// Minimal BrandingContext shim for the assist components.

export const DEFAULT_LOGO = `${import.meta.env.BASE_URL}arcanus-logo.png`;

export function useBranding() {
  return { resolvedLogo: DEFAULT_LOGO };
}

export default useBranding;
