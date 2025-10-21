import { Link as RouterLink, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import PlaceIcon from '@mui/icons-material/Place';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: false
};

function PinDetails() {
  const { pinId } = useParams();

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
        <Breadcrumbs separator="›" aria-label="breadcrumb">
          <Button component={RouterLink} to="/list" variant="text">
            Pins
          </Button>
          <Typography color="text.secondary">Pin {pinId}</Typography>
        </Breadcrumbs>

        <Box>
          <Typography variant="h5" gutterBottom>
            Pin {pinId}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This is a placeholder detail page. In the future it can show metadata, photos,
            and actions for each saved pin.
          </Typography>
        </Box>

        <Button component={RouterLink} to="/map" variant="contained">
          Back to Map
        </Button>
      </Stack>
    </Box>
  );
}

export default PinDetails;
