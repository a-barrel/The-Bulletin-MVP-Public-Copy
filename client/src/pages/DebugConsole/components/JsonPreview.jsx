import Box from '@mui/material/Box';

import { JSON_PREVIEW_SX } from '../constants';

function JsonPreview({ data }) {
  if (data === null || data === undefined) {
    return null;
  }

  return (
    <Box component="pre" sx={JSON_PREVIEW_SX}>
      {JSON.stringify(data, null, 2)}
    </Box>
  );
}

export default JsonPreview;
