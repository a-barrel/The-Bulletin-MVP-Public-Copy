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
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 }
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 960 }}>
        <Typography variant="h4" component="h1">
          DEBUG_CONSOLE
        </Typography>

        <Tabs
          value={activeTabId}
          onChange={(_event, value) => setActiveTabId(value)}
          aria-label="Debug console sections"
          textColor="primary"
          indicatorColor="primary"
          orientation={useVerticalTabs ? 'vertical' : 'horizontal'}
          variant="standard"
          sx={{
            width: '100%',
            backgroundColor: '#ECF8FE',
            borderRadius: 2,
            border: '1px solid #9B5DE5',
            '& .MuiTabs-indicator': {
              backgroundColor: '#5D3889'
            },
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
                    color: '#1F1336',
                    '&.Mui-selected': {
                      color: '#5D3889',
                      fontWeight: 600
                    }
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
                    color: '#1F1336',
                    '&.Mui-selected': {
                      color: '#5D3889',
                      fontWeight: 600
                    }
                  }
                })
          }}
        >
          {TAB_DEFINITIONS.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              value={tab.id}
              id={`debug-tab-${tab.id}`}
              aria-controls={`debug-tabpanel-${tab.id}`}
            />
          ))}
        </Tabs>

        <Box sx={{ display: 'contents' }}>
          {activeTab ? (
            <Suspense fallback={<Typography>Loading tab…</Typography>}>
              <activeTab.Component />
            </Suspense>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}
