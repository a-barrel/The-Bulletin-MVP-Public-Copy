import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorFallback from '../ErrorFallback';

jest.mock('../../utils/reportClientError', () => jest.fn());

describe('ErrorFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders primary text and logs the error message', () => {
    const testError = new Error('fail whale');
    const reportClientError = require('../../utils/reportClientError');

    render(<ErrorFallback error={testError} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('fail whale')).toBeInTheDocument();
    expect(reportClientError).toHaveBeenCalledWith(testError, 'Unhandled error captured by boundary');
  });

  it('invokes retry and reload callbacks', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    const onReload = jest.fn();
    render(<ErrorFallback onRetry={onRetry} onReload={onReload} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reload app/i }));
    expect(onReload).toHaveBeenCalled();
  });
});
