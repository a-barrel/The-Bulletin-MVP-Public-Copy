import { Suspense, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import TAB_DEFINITIONS from './tabRegistry';
import useBadgeAwardOnEntry from '../../hooks/useBadgeAwardOnEntry';
import '../../styles/debug-console.css';

export function DebugConsolePage() {
  const [activeTabId, setActiveTabId] = useState(TAB_DEFINITIONS[0]?.id ?? 'pin');
  useBadgeAwardOnEntry('enter-debug-console');

  const theme = useTheme();
  const useVerticalTabs = useMediaQuery(theme.breakpoints.down('md'));

  const activeTab = useMemo(
    () => TAB_DEFINITIONS.find((tab) => tab.id === activeTabId) ?? TAB_DEFINITIONS[0],
    [activeTabId]
  );

  return (
    <Box
      className="debug-console-shell"
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 }
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 1060 }}>
        <Box className="debug-console-header">
          <Box>
            <Typography variant="h4" component="h1" className="debug-console-title">
              Debug Console
            </Typography>
            <Typography variant="body1" className="debug-console-subtitle">
              Admin-only control room for diagnostics, live chat tools, and data audits.
            </Typography>
          </Box>
          <span className="debug-console-badge">Admin</span>
        </Box>

        <Tabs
          className="debug-console-tabs"
          value={activeTabId}
          onChange={(_event, value) => setActiveTabId(value)}
          aria-label="Debug console sections"
          textColor="primary"
          indicatorColor="primary"
          orientation={useVerticalTabs ? 'vertical' : 'horizontal'}
          variant="standard"
          sx={{
            width: '100%',
            ...(useVerticalTabs
              ? {
                  alignSelf: 'stretch',
                  '& .MuiTabs-flexContainer': {
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1,
                    flexWrap: 'nowrap'
                  },
                  '& .MuiTab-root': {
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    minWidth: 'auto',
                    color: '#1F1336'
                  },
                  '& .MuiTabs-indicator': {
                    left: 0
                  }
                }
              : {
                  '& .MuiTabs-flexContainer': {
                    flexWrap: 'wrap',
                    columnGap: 1,
                    rowGap: 1,
                    justifyContent: 'flex-start'
                  },
                  '& .MuiTab-root': {
                    minWidth: 'auto',
                    flex: '0 0 auto',
                    color: '#1F1336'
                  }
                })
          }}
        >
          {TAB_DEFINITIONS.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              value={tab.id}
              className="debug-console-tab"
              id={`debug-tab-${tab.id}`}
              aria-controls={`debug-tabpanel-${tab.id}`}
            />
          ))}
        </Tabs>

        <Box sx={{ display: 'contents' }}>
          {activeTab ? (
            <Suspense
              fallback={
                <Typography variant="body2" color="text.secondary">
                  {activeTab.fallback ?? 'Loading tab…'}
                </Typography>
              }
            >
              <activeTab.Component />
            </Suspense>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}
