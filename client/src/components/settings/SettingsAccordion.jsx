import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import settingsPalette from './settingsPalette';

function SettingsAccordion({ title, description, children, defaultExpanded, disableGutters }) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters={disableGutters}
      square={false}
      sx={{
        borderRadius: 2,
        backgroundColor: settingsPalette.pastelLavender,
        boxShadow: '0 12px 35px rgba(93, 56, 137, 0.12)',
        border: `1px solid ${settingsPalette.borderSubtle}`,
        '&:before': { display: 'none' },
        '& .MuiAccordionSummary-root': {
          borderBottom: `1px solid ${settingsPalette.borderSubtle}`
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: settingsPalette.accent }} />}
        sx={{
          '& .MuiAccordionSummary-content': {
            flexDirection: 'column',
            gap: 0.5,
            margin: 0
          }
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: settingsPalette.accent }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" sx={{ color: settingsPalette.textMuted }}>
            {description}
          </Typography>
        ) : null}
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{children}</Box>
      </AccordionDetails>
    </Accordion>
  );
}

SettingsAccordion.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  defaultExpanded: PropTypes.bool,
  disableGutters: PropTypes.bool
};

SettingsAccordion.defaultProps = {
  description: null,
  defaultExpanded: true,
  disableGutters: true
};

export default SettingsAccordion;
