import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { FRIEND_ENGAGEMENT_OPTIONS } from '../constants/listFilters';

const TYPE_OPTIONS = ['event', 'discussion'];

const STATUS_OPTIONS = ['active', 'expired', 'all'];

const FRIEND_ENGAGEMENT_VALUE_SET = new Set(FRIEND_ENGAGEMENT_OPTIONS);

const POPULAR_SORT_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'replies', label: 'Most replies' },
  { value: 'attending', label: 'Most attending' }
];

const normalizeFilters = (filters, defaults) => ({
  search: filters.search ?? defaults.search ?? '',
  status: filters.status ?? defaults.status ?? 'active',
  startDate: filters.startDate ?? '',
  endDate: filters.endDate ?? '',
  types: Array.isArray(filters.types) ? filters.types : [...(defaults.types ?? [])],
  categories: Array.isArray(filters.categories)
    ? filters.categories
    : [...(defaults.categories ?? [])],
  friendEngagements: Array.isArray(filters.friendEngagements)
    ? filters.friendEngagements.filter((entry) => FRIEND_ENGAGEMENT_VALUE_SET.has(entry))
    : [...(defaults.friendEngagements ?? [])],
  popularSort: filters.popularSort ?? defaults.popularSort ?? null
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
  const { t } = useTranslation();
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

  const typeOptions = useMemo(
    () =>
      TYPE_OPTIONS.map((value) => ({
        value,
        label: t(`bookmarks.filters.typeOptions.${value}`)
      })),
    [t]
  );

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((value) => ({
        value,
        label: t(`bookmarks.filters.statusOptions.${value}`)
      })),
    [t]
  );

  const friendEngagementOptions = useMemo(
    () =>
      FRIEND_ENGAGEMENT_OPTIONS.map((value) => ({
        value,
        label: t(`bookmarks.filters.friendOptions.${value}.label`),
        chipLabel: t(`bookmarks.filters.friendOptions.${value}.chip`)
      })),
    [t]
  );

  const popularOptions = useMemo(
    () => [
      { value: null, label: t('bookmarks.filters.popularOptions.none') },
      { value: 'replies', label: t('bookmarks.filters.popularOptions.replies') },
      { value: 'attending', label: t('bookmarks.filters.popularOptions.attending') }
    ],
    [t]
  );

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

  const handleToggleType = useCallback((value) => {
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
  }, []);

  const handleToggleFriendEngagement = useCallback((value) => {
    if (!FRIEND_ENGAGEMENT_VALUE_SET.has(value)) {
      return;
    }
    setLocalFilters((prev) => {
      const current = new Set(prev.friendEngagements || []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return {
        ...prev,
        friendEngagements: Array.from(current)
      };
    });
  }, []);

  const handleToggleCategory = useCallback((category) => {
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
  }, []);

  const handleAddCategory = useCallback(() => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      return;
    }
    setLocalFilters((prev) => ({
      ...prev,
      categories: uniqueMerge(prev.categories, [trimmed])
    }));
    setNewCategory('');
  }, [newCategory]);

  const handleEnterCategory = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCategory();
    }
  }, [handleAddCategory]);

  const handlePopularSortChange = useCallback((event) => {
    const value = event.target.value || null;
    setLocalFilters((prev) => ({
      ...prev,
      popularSort: value === 'replies' || value === 'attending' ? value : null
    }));
  }, []);

  const handleStatusChange = useCallback((event) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: event.target.value
    }));
  }, []);

  const handleDateChange = useCallback(
    (key) => (event) => {
      setLocalFilters((prev) => ({
        ...prev,
        [key]: event.target.value
      }));
    },
    []
  );

  const handleSearchChange = useCallback((event) => {
    setLocalFilters((prev) => ({
      ...prev,
      search: event.target.value
    }));
  }, []);

  const handleNewCategoryChange = useCallback((event) => {
    setNewCategory(event.target.value);
  }, []);

  const handleClearLocal = useCallback(() => {
    setLocalFilters(normalizeFilters(defaultFilters, defaultFilters));
    setNewCategory('');
    onClear?.();
  }, [defaultFilters, onClear]);

  const handleApply = useCallback(() => {
    const normalized = normalizeFilters(localFilters, defaultFilters);
    const { popularSort, ...rest } = normalized;
    const payload = {
      ...rest,
      ...(popularSort ? { popularSort } : {}),
      types: [...normalized.types],
      categories: [...normalized.categories],
      friendEngagements: [...(normalized.friendEngagements || [])]
    };
    onApply({
      ...payload
    });
    onClose();
  }, [defaultFilters, localFilters, onApply, onClose]);

  const handleCancel = useCallback(() => {
    setLocalFilters(normalizeFilters(initialFilters, defaultFilters));
    setNewCategory('');
    onClose();
  }, [defaultFilters, initialFilters, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullWidth
      maxWidth="md"
      className="filters-dialog"
      slotProps={{ backdrop: { className: 'filters-backdrop' } }}
    >
      <DialogTitle className="filters-title">{t('bookmarks.filters.title')}</DialogTitle>

      <DialogContent dividers className="filters-content">
        <Stack spacing={3}>
          {/* Keyword search */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('bookmarks.filters.keyword')}
            </Typography>
            <TextField
              value={localFilters.search}
              onChange={handleSearchChange}
              placeholder={t('bookmarks.filters.keywordPlaceholder')}
              fullWidth
            />
          </Stack>

          <Divider />

          {/* Pin types */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('bookmarks.filters.pinTypes')}
            </Typography>
            <FormGroup row>
              {typeOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={localFilters.types.includes(option.value)}
                      onChange={() => handleToggleType(option.value)}
                      disableRipple
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>
          </Stack>

          <Divider />

          {/* Friend activity */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('bookmarks.filters.friendActivity')}
            </Typography>
            <FormGroup row>
              {friendEngagementOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={localFilters.friendEngagements.includes(option.value)}
                      onChange={() => handleToggleFriendEngagement(option.value)}
                      disableRipple
                    />
                  }
                  label={option.label}
                />
              ))}
            </FormGroup>
          </Stack>

          <Divider />

          {/* Popular pins */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              {t('bookmarks.filters.popularPins')}
            </Typography>
            <RadioGroup
              row
              value={localFilters.popularSort || null}
              onChange={handlePopularSortChange}
            >
              {popularOptions.map((option) => (
                <FormControlLabel
                  key={option.value ?? 'none'}
                  value={option.value ?? ''}
                  control={<Radio disableRipple />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </Stack>

          <Divider />

          {/* Categories */}
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">
                {t('bookmarks.filters.categories')}
              </Typography>
              <IconButton
                size="small"
                onClick={onRefreshCategories}
                disabled={loadingCategories}
                aria-label={t('bookmarks.filters.refreshCategories')}
                aria-busy={loadingCategories ? 'true' : undefined}
                title={loadingCategories ? t('bookmarks.filters.refreshing') : t('bookmarks.filters.refreshCategories')}
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
                label={t('bookmarks.filters.addCategoryLabel')}
                value={newCategory}
                onChange={handleNewCategoryChange}
                onKeyDown={handleEnterCategory}
                size="small"
                placeholder={t('bookmarks.filters.addCategoryPlaceholder')}
              />
              <Button
                type="button"
                variant="outlined"
                onClick={handleAddCategory}
                disabled={!newCategory.trim()}
              >
                {t('bookmarks.filters.addCategory')}
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
                  {t('bookmarks.filters.noCategories')}
                </Typography>
              ) : (
                categoryOptions.map((option) => {
                  const selected = localFilters.categories.includes(option.name);
                  return (
                    <Chip
                      key={option.name}
                      label={
                        option.count
                          ? t('bookmarks.filters.categoryWithCount', {
                              name: option.name,
                              count: option.count
                            })
                          : option.name
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
              {t('bookmarks.filters.dateRange')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label={t('bookmarks.filters.startDate')}
                type="date"
                value={localFilters.startDate}
                onChange={handleDateChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label={t('bookmarks.filters.endDate')}
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
              {t('bookmarks.filters.status')}
            </Typography>
            <RadioGroup row value={localFilters.status} onChange={handleStatusChange}>
              {statusOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                control={<Radio disableRipple />}
                label={option.label}
              />
            ))}
          </RadioGroup>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions className="filters-actions">
        <Button onClick={handleCancel} disableRipple>
          {t('bookmarks.filters.cancel')}
        </Button>
        <Button onClick={handleClearLocal} color="inherit" disableRipple>
          {t('bookmarks.filters.clear')}
        </Button>
        <Button onClick={handleApply} variant="contained" disableRipple>
          {t('bookmarks.filters.apply')}
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
    categories: PropTypes.arrayOf(PropTypes.string),
    friendEngagements: PropTypes.arrayOf(PropTypes.string)
  }),
  initialFilters: PropTypes.shape({
    search: PropTypes.string,
    status: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    types: PropTypes.arrayOf(PropTypes.string),
    categories: PropTypes.arrayOf(PropTypes.string),
    friendEngagements: PropTypes.arrayOf(PropTypes.string)
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
    categories: [],
    friendEngagements: []
  },
  initialFilters: {
    search: '',
    status: 'active',
    startDate: '',
    endDate: '',
    types: [],
    categories: [],
    friendEngagements: []
  },
  categories: [],
  loadingCategories: false,
  onRefreshCategories: undefined,
  categoryError: null
};
