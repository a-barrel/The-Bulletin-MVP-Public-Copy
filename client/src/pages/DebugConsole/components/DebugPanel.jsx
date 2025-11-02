import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const DebugPanel = ({
  title,
  description,
  actions,
  alerts = [],
  children,
  sx,
  component = 'div',
  headerProps,
  ...paperProps
}) => {
  const resolvedAlerts = Array.isArray(alerts)
    ? alerts.filter(Boolean)
    : [];

  const renderActions = () => {
    if (!actions) {
      return null;
    }

    if (Array.isArray(actions)) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {actions.map((action, index) => (
            <Box key={index} sx={{ display: 'inline-flex' }}>
              {action}
            </Box>
          ))}
        </Stack>
      );
    }

    return actions;
  };

  return (
    <Paper
      component={component}
      sx={{
        p: { xs: 2, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...sx
      }}
      {...paperProps}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        {...headerProps}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {renderActions()}
      </Stack>

      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}

      {resolvedAlerts.map((alert, index) => (
        <Alert
          key={alert.key ?? index}
          severity={alert.severity}
          onClose={alert.onClose}
          sx={alert.sx}
        >
          {alert.content}
        </Alert>
      ))}

      {children}
    </Paper>
  );
};

DebugPanel.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  actions: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)]),
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      severity: PropTypes.oneOf(['error', 'info', 'success', 'warning']).isRequired,
      content: PropTypes.node.isRequired,
      onClose: PropTypes.func,
      sx: PropTypes.object
    })
  ),
  children: PropTypes.node,
  sx: PropTypes.object,
  component: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  headerProps: PropTypes.object
};

DebugPanel.defaultProps = {
  description: null,
  actions: null,
  alerts: [],
  children: null,
  sx: undefined,
  component: 'div',
  headerProps: undefined
};

export default DebugPanel;
