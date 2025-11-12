import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@mui/material';
import './ImageOverlay.css';

function ImagePreviewDialog({ open, onClose, imageSrc }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth={false}
      className="image-preview-dialog"
    >
      <DialogContent className="image-preview-content">
        {imageSrc && (
          <img
            src={imageSrc}
            alt="Enlarged preview"
            className="image-preview-img"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

ImagePreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  imageSrc: PropTypes.string
};

export default ImagePreviewDialog;
