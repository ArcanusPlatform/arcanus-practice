import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import styles from './FeedbackButtons.module.css';

interface FeedbackButtonsProps {
  pageId: string;
}

export default function FeedbackButtons({ pageId }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = (type: 'helpful' | 'not-helpful') => {
    setFeedback(type);
    // TODO: Send feedback to analytics/backend
    console.log(`Feedback for ${pageId}:`, type);
  };

  if (feedback) {
    return (
      <div className={styles.successMessage}>
        ✓ Thank you for your feedback!
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p className={styles.question}>
        Was this page helpful?
      </p>
      <div className={styles.buttonGroup}>
        <button
          onClick={() => handleFeedback('helpful')}
          className={`${styles.button} ${styles.helpfulButton}`}
        >
          <ThumbsUp size={18} />
          Yes, helpful
        </button>
        <button
          onClick={() => handleFeedback('not-helpful')}
          className={`${styles.button} ${styles.notHelpfulButton}`}
        >
          <ThumbsDown size={18} />
          No, not helpful
        </button>
      </div>
    </div>
  );
}
