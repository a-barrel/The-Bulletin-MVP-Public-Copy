import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MapIcon from '@mui/icons-material/Map';

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: ListAltIcon,
  path: '/list',
  order: 2,
  showInNav: true
};

function ListPage() {
  return (
    <Box
      component="section"
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3
      }}
    >
      <Stack
        spacing={3}
        sx={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'background.paper',
          p: 4,
          borderRadius: 2,
          boxShadow: 6
        }}
      >
        <Box>
          <Typography variant="h5" gutterBottom>
            Sample Pins
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This page is a placeholder list view to test navigation between different screens.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            component={RouterLink}
            to="/map"
            variant="contained"
            startIcon={<MapIcon />}
          >
            View Map
          </Button>
          <Button
            component={RouterLink}
            to="/pin/123"
            variant="outlined"
          >
            Open Pin 123
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default ListPage;
