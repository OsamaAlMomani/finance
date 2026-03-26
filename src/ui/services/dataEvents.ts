const FINANCE_DATA_CHANGED_EVENT = 'finance:data-changed';

type FinanceDataChangedDetail = {
  channel?: string;
  at?: string;
};

type FinanceDataChangedEvent = CustomEvent<FinanceDataChangedDetail>;

const emitFinanceDataChanged = (detail: FinanceDataChangedDetail = {}) => {
  window.dispatchEvent(new CustomEvent(FINANCE_DATA_CHANGED_EVENT, { detail }));
};

const onFinanceDataChanged = (handler: (event: FinanceDataChangedEvent) => void) => {
  const listener = (event: Event) => {
    handler(event as FinanceDataChangedEvent);
  };
  window.addEventListener(FINANCE_DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(FINANCE_DATA_CHANGED_EVENT, listener);
};

export {
  FINANCE_DATA_CHANGED_EVENT,
  emitFinanceDataChanged,
  onFinanceDataChanged
};
