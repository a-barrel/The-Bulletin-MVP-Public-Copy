import PropTypes from 'prop-types';
import { memo, useMemo } from 'react';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ArticleIcon from '@mui/icons-material/Article';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './NavConsoleModal.css';

function NavConsoleModal({
  open,
  onClose,
  navPages,
  previousNavPath,
  previousNavPage,
  currentNavPath,
  onBack,
  onNavigate
}) {
  const wrapperStyle = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      pointerEvents: 'none'
    }),
    []
  );

  if (!open) {
    return null;
  }

  return (
    <Modal open onClose={onClose} closeAfterTransition keepMounted>
      <Fade in={open}>
        <Box sx={wrapperStyle}>
          <Paper
            elevation={16}
            className="nav-console-paper"
          >
            <Stack spacing={1.5} className="nav-console-body">
              <Box className="nav-console-header-row">
                <Typography variant="h6" component="h2">
                  Navigation Console
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Press ` or Esc to close
                </Typography>
              </Box>
              <Divider />
              {navPages.length > 0 ? (
                <Box className="nav-console-main">
                  {previousNavPath ? (
                    <Button
                      onClick={onBack}
                      variant="contained"
                      color="secondary"
                      startIcon={<ArrowBackIcon fontSize="small" />}
                      className="nav-console-button"
                    >
                      {previousNavPage ? `Back to ${previousNavPage.label}` : 'Back'}
                    </Button>
                  ) : null}
                  <Box
                    className="nav-console-list-wrapper"
                  >
                    <Stack spacing={1}>
                      {navPages.map((page) => {
                        const IconComponent = page.icon ?? ArticleIcon;
                        const isActive = page.path === currentNavPath;
                        return (
                          <Button
                            key={page.id}
                            onClick={() => onNavigate(page)}
                            variant={isActive ? 'contained' : 'outlined'}
                            color={isActive ? 'primary' : 'inherit'}
                            startIcon={<IconComponent fontSize="small" />}
                            className="nav-console-button"
                          >
                            {page.label}
                          </Button>
                        );
                      })}
                    </Stack>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Add a new page under `src/pages` with `showInNav: true` to populate this console.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Box>
      </Fade>
    </Modal>
  );
}

NavConsoleModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  navPages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
      icon: PropTypes.elementType
    })
  ).isRequired,
  previousNavPath: PropTypes.string,
  previousNavPage: PropTypes.shape({
    label: PropTypes.string
  }),
  currentNavPath: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired
};

NavConsoleModal.defaultProps = {
  previousNavPath: null,
  previousNavPage: null,
  currentNavPath: null
};

export default memo(NavConsoleModal);
