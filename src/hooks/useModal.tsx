import { useState, useCallback } from 'react';

export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'alert' | 'confirm'>('alert');
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((msg: string): Promise<void> => {
    return new Promise((resolve) => {
      setMessage(msg);
      setType('alert');
      setIsOpen(true);
      setResolver(() => () => {
        setIsOpen(false);
        resolve();
      });
    });
  }, []);

  const showConfirm = useCallback((msg: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setMessage(msg);
      setType('confirm');
      setIsOpen(true);
      setResolver(() => (result: boolean) => {
        setIsOpen(false);
        resolve(result);
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolver) {
      resolver(true);
    }
  }, [resolver]);

  const handleCancel = useCallback(() => {
    if (resolver) {
      resolver(false);
    }
  }, [resolver]);

  return {
    isOpen,
    message,
    type,
    showAlert,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
};
