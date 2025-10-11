import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FigmaMobileShell from './FigmaMobileShell';
import figmaSettings from '../data/figmaSettings.json';

const SettingsPrototype = () => {
  const { header, sections } = figmaSettings;

  return (
    <FigmaMobileShell time={header.time} title={header.title} contentSpacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          px: 3,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#ffffff',
          border: '1px solid rgba(93, 56, 137, 0.12)'
        }}
      >
        {sections.map((section, index) => {
          if (section.heading) {
            return (
              <Stack key={`heading-${index}`} spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {section.heading.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {section.heading.subtitle}
                </Typography>
              </Stack>
            );
          }

          return (
            <Stack key={`section-${index}`} spacing={1.5}>
              {section.items?.map((item) => (
                <Paper
                  key={item.label}
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid rgba(93, 56, 137, 0.12)',
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    {item.shortcut ? <Chip label={item.shortcut} size="small" /> : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          );
        })}
      </Paper>
    </FigmaMobileShell>
  );
};

export default SettingsPrototype;
