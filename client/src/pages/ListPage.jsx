import { useNavigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MapIcon from '@mui/icons-material/Map';
import PinListItem from '../components/PinListItem';

export const pageConfig = {
  id: 'list',
  label: 'List',
  icon: ListAltIcon,
  path: '/list',
  order: 2,
  showInNav: true
};

function ListPage() {
  const navigate = useNavigate();
  const pins = [
    { _id: '123', title: 'Lost Dog', description: 'Brown lab seen near park.', locationName: 'Central Park', authorName: 'Alex' },
    { _id: '456', title: 'Free Couch', description: 'On the curb, first come.', locationName: '5th Ave', authorName: 'Sam' },
    { _id: '789', title: 'Community Cleanup', description: 'Saturday 9am by the river.', locationName: 'Riverside', authorName: 'Taylor' }
  ];

  const handleOpenPin = (pin) => {
    navigate(`/pin/${pin._id}`);
  };

  return (
    <Box
      component="section"
      sx={{
        py: 4,
        px: 2
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          maxWidth: 600,
          mx: 'auto'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" component="h1">
            Pins
          </Typography>
          <Button
            component={RouterLink}
            to="/map"
            variant="contained"
            startIcon={<MapIcon />}
          >
            View Map
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          {pins.map((pin) => (
            <PinListItem key={pin._id} pin={pin} onClick={handleOpenPin} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

export default ListPage;
