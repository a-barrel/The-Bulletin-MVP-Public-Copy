import { useEffect, useMemo, useState } from 'react';
import './ListFiltersOverlay.css';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  Checkbox,
  CircularProgress,
  IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

const TYPE_OPTIONS = [
  { value: 'event', label: 'Events' },
  { value: 'discussion', label: 'Discussions' }
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All pins' }
];

const normalizeFilters = (filters, defaults) => ({
  search: filters.search ?? defaults.search ?? '',
  status: filters.status ?? defaults.status ?? 'active',
  startDate: filters.startDate ?? '',
  endDate: filters.endDate ?? '',
  types: Array.isArray(filters.types) ? filters.types : [...(defaults.types ?? [])],
  categories: Array.isArray(filters.categories)
    ? filters.categories
    : [...(defaults.categories ?? [])]
});

function uniqueMerge(list = [], additions = []) {
  const merged = new Set(list);
  additions.forEach((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      merged.add(entry.trim());
    }
  });
  return Array.from(merged);
}

export default function ListFiltersOverlay({
  open,
  onClose,
  onApply,
  onClear,
  defaultFilters,
  initialFilters,
  categories,
  loadingCategories = false,
  onRefreshCategories,
  categoryError = null
}) {
  const [localFilters, setLocalFilters] = useState(() =>
    normalizeFilters(initialFilters, defaultFilters)
  );
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (open) {
      setLocalFilters(normalizeFilters(initialFilters, defaultFilters));
      setNewCategory('');
    }
  }, [open, initialFilters, defaultFilters]);

  const categoryOptions = useMemo(() => {
    const optionNames = new Set();
    const options = [];
    categories.forEach((entry) => {
      const name = typeof entry === 'string' ? entry : entry?.name;
      if (!name || optionNames.has(name)) {
        return;
      }
      optionNames.add(name);
      options.push({
        name,
        count: typeof entry?.count === 'number' ? entry.count : null
      });
    });
    const selectedButMissing = localFilters.categories.filter(
      (category) => !optionNames.has(category)
    );
    selectedButMissing.forEach((category) => {
      optionNames.add(category);
      options.push({ name: category, count: null });
    });
    return options;
  }, [categories, localFilters.categories]);

  const handleToggleType = (value) => {
    setLocalFilters((prev) => {
      const types = new Set(prev.types);
      if (types.has(value)) {
        types.delete(value);
      } else {
        types.add(value);
      }
      return {
        ...prev,
        types: Array.from(types)
      };
    });
  };

  const handleToggleCategory = (category) => {
    setLocalFilters((prev) => {
      const categories = new Set(prev.categories);
      if (categories.has(category)) {
        categories.delete(category);
      } else {
        categories.add(category);
      }
      return {
        ...prev,
        categories: Array.from(categories)
      };
    });
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      return;
    }
    setLocalFilters((prev) => ({
      ...prev,
      categories: uniqueMerge(prev.categories, [trimmed])
    }));
    setNewCategory('');
  };

  const handleEnterCategory = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCategory();
    }
  };

  const handleStatusChange = (event) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: event.target.value
    }));
  };

  const handleDateChange = (key) => (event) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: event.target.value
    }));
  };

  const handleSearchChange = (event) => {
    setLocalFilters((prev) => ({
      ...prev,
      search: event.target.value
    }));
  };

  const handleClearLocal = () => {
    setLocalFilters(normalizeFilters(defaultFilters, defaultFilters));
    setNewCategory('');
    onClear?.();
  };

  const handleApply = () => {
    const normalized = normalizeFilters(localFilters, defaultFilters);
    onApply({
      ...normalized,
      types: [...normalized.types],
      categories: [...normalized.categories]
    });
    onClose();
  };

  const handleCancel = () => {
    setLocalFilters(normalizeFilters(initialFilters, defaultFilters));
    setNewCategory('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullWidth
      maxWidth="md"
      className="filters-dialog"
      slotProps={{ backdrop: { className: 'filters-backdrop' } }}
    >
      <DialogTitle className="filters-title">Discover pins</DialogTitle>

      <DialogContent dividers className="filters-content">
        <Stack spacing={3}>
          {/* Keyword search */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Keyword search
            </Typography>
            <TextField
              value={localFilters.search}
              onChange={handleSearchChange}
              placeholder="Search titles, descriptions, or tags"
              fullWidth
            />
          </Stack>

          <Divider />

          {/* Pin types */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Pin types
            </Typography>
            <FormGroup row>
              {TYPE_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={localFilters.types.includes(option.value)}
                      onChange={() => handleToggleType(option.value)}
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>
          </Stack>

          <Divider />

          {/* Categories */}
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">
                Categories
              </Typography>
              <IconButton
                size="small"
                onClick={onRefreshCategories}
                disabled={loadingCategories}
                aria-label="Refresh categories"
                aria-busy={loadingCategories ? 'true' : undefined}
                title={loadingCategories ? 'Refreshing…' : 'Refresh categories'}
              >
                <RefreshIcon
                  fontSize="inherit"
                  className={loadingCategories ? 'filters-refresh-spin' : undefined}
                />
              </IconButton>
            </Stack>

            {categoryError ? (
              <Alert severity="error" variant="outlined">
                {categoryError}
              </Alert>
            ) : null}

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Add category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={handleEnterCategory}
                size="small"
                placeholder="e.g. Food, Study Group"
              />
              <Button
                type="button"
                variant="outlined"
                onClick={handleAddCategory}
                disabled={!newCategory.trim()}
              >
                Add
              </Button>
            </Stack>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                minHeight: 40,
                alignItems: loadingCategories ? 'center' : 'flex-start',
              }}
            >
              {loadingCategories ? (
                <CircularProgress size={24} />
              ) : categoryOptions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No categories available yet.
                </Typography>
              ) : (
                categoryOptions.map((option) => {
                  const selected = localFilters.categories.includes(option.name);
                  return (
                    <Chip
                      key={option.name}
                      label={
                        option.count ? `${option.name} (${option.count})` : option.name
                      }
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      onClick={() => handleToggleCategory(option.name)}
                      onDelete={selected ? () => handleToggleCategory(option.name) : undefined}
                      deleteIcon={selected ? undefined : null}
                    />
                  );
                })
              )}
            </Box>
          </Stack>

          <Divider />

          {/* Date range */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Date range
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Start date"
                type="date"
                value={localFilters.startDate}
                onChange={handleDateChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End date"
                type="date"
                value={localFilters.endDate}
                onChange={handleDateChange('endDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>

          <Divider />

          {/* Status */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Status
            </Typography>
            <RadioGroup row value={localFilters.status} onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions className="filters-actions">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleClearLocal} color="inherit">
          Clear filters
        </Button>
        <Button onClick={handleApply} variant="contained">
          Apply filters
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ListFiltersOverlay.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onClear: PropTypes.func,
  defaultFilters: PropTypes.shape({
    search: PropTypes.string,
    status: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    types: PropTypes.arrayOf(PropTypes.string),
    categories: PropTypes.arrayOf(PropTypes.string)
  }),
  initialFilters: PropTypes.shape({
    search: PropTypes.string,
    status: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    types: PropTypes.arrayOf(PropTypes.string),
    categories: PropTypes.arrayOf(PropTypes.string)
  }),
  categories: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        count: PropTypes.number
      })
    ])
  ),
  loadingCategories: PropTypes.bool,
  onRefreshCategories: PropTypes.func,
  categoryError: PropTypes.string
};

ListFiltersOverlay.defaultProps = {
  onClear: undefined,
  defaultFilters: {
    search: '',
    status: 'active',
    startDate: '',
    endDate: '',
    types: [],
    categories: []
  },
  initialFilters: {
    search: '',
    status: 'active',
    startDate: '',
    endDate: '',
    types: [],
    categories: []
  },
  categories: [],
  loadingCategories: false,
  onRefreshCategories: undefined,
  categoryError: null
};
