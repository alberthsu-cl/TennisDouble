import React from 'react';

interface CustomModalProps {
  isOpen: boolean;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  message,
  type,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="custom-modal-overlay" onClick={type === 'alert' ? handleConfirm : handleCancel}>
      <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-content">
          <div className="custom-modal-message">{message}</div>
          <div className="custom-modal-buttons">
            {type === 'confirm' && (
              <button className="custom-modal-btn custom-modal-btn-cancel" onClick={handleCancel}>
                取消
              </button>
            )}
            <button className="custom-modal-btn custom-modal-btn-confirm" onClick={handleConfirm}>
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
