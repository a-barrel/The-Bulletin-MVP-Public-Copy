import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import FigmaMobileShell from './FigmaMobileShell';
import figmaUpdates from '../data/figmaUpdates.json';

const UpdateCard = ({ card }) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: 3,
      border: '1px solid rgba(93, 56, 137, 0.12)',
      px: 2,
      py: 1.5,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
      backgroundColor: '#fff'
    }}
  >
    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
      {card.title}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {card.description}
    </Typography>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="caption" color="text.secondary">
        {card.timestamp}
      </Typography>
      {card.cta ? (
        <Button size="small" sx={{ textTransform: 'none' }}>
          {card.cta}
        </Button>
      ) : null}
    </Stack>
  </Paper>
);

const UpdatesPrototype = () => {
  const { header, tabs, cards } = figmaUpdates;

  return (
    <FigmaMobileShell
      time={header.time}
      title={header.title}
      contentSpacing={2.5}
      rightSlot={
        header.actions?.clearLabel ? (
          <Button size="small" sx={{ textTransform: 'none' }}>
            {header.actions.clearLabel}
          </Button>
        ) : null
      }
    >
      <ToggleButtonGroup exclusive value={tabs[0]} sx={{ alignSelf: 'stretch' }}>
        {tabs.map((tab) => (
          <ToggleButton key={tab} value={tab} sx={{ textTransform: 'none' }}>
            {tab}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack spacing={1.5}>
        {cards.map((card) => (
          <UpdateCard key={card.type} card={card} />
        ))}
      </Stack>
    </FigmaMobileShell>
  );
};

export default UpdatesPrototype;
