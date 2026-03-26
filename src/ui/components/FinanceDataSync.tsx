import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { financeQueryKeys } from '../query/financeQueryKeys';

export const FinanceDataSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onDataChanged = () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
    };

    window.addEventListener('finance:data-changed', onDataChanged);
    return () => window.removeEventListener('finance:data-changed', onDataChanged);
  }, [queryClient]);

  return null;
};

