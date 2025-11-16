import { fireEvent, render, screen } from '@testing-library/react';
import ChatComposerFooter from '../ChatComposerFooter';

describe('ChatComposerFooter', () => {
  it('renders attachment preview and forwards composer events', () => {
    const handleAdd = jest.fn();
    const handleChange = jest.fn();
    const handleSend = jest.fn();

    render(
      <ChatComposerFooter
        variant="modern"
        message="Hello"
        placeholder="Send"
        onMessageChange={handleChange}
        onKeyDown={jest.fn()}
        onSend={handleSend}
        containerRef={{ current: null }}
        containerClassName="chat-input-container"
        inputRef={{ current: null }}
        onAddAttachment={handleAdd}
        attachments={[
          {
            id: 'a',
            asset: { url: 'https://placehold.co/32x32', description: 'test' }
          }
        ]}
        attachmentStatus={{ type: 'info', message: 'Uploading…' }}
        isUploadingAttachment
        gifPreview={null}
        gifPreviewError={null}
        isGifPreviewLoading={false}
      />
    );

    expect(screen.getAllByText(/Uploading/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add attachment/i }));
    expect(handleAdd).toHaveBeenCalled();
  });
});
