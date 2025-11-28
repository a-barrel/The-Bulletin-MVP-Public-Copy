import PropTypes from 'prop-types';
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
  if (!open) {
    return null;
  }

  return (
    <Modal open onClose={onClose} closeAfterTransition keepMounted>
      <Fade in={open}>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            pointerEvents: 'none'
          }}
        >
          <Paper
            elevation={16}
            sx={(muiTheme) => ({
              width: 'min(420px, 90vw)',
              maxHeight: '80vh',
              overflow: 'hidden',
              pointerEvents: 'auto',
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              p: 3,
              borderRadius: 3,
              backgroundColor: muiTheme.palette.background.paper
            })}
          >
            <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="h2">
                  Navigation Console
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Press ` or Esc to close
                </Typography>
              </Box>
              <Divider />
              {navPages.length > 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    flex: 1,
                    minHeight: 0
                  }}
                >
                  {previousNavPath ? (
                    <Button
                      onClick={onBack}
                      variant="contained"
                      color="secondary"
                      startIcon={<ArrowBackIcon fontSize="small" />}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      {previousNavPage ? `Back to ${previousNavPage.label}` : 'Back'}
                    </Button>
                  ) : null}
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      pr: 0.5,
                      scrollbarGutter: 'stable'
                    }}
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
                            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
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

export default NavConsoleModal;
