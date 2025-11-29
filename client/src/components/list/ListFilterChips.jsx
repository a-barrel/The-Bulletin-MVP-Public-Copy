import Chip from '@mui/material/Chip';

export default function ListFilterChips({ chips, onClearAll }) {
  if (!chips?.length) {
    return null;
  }

  return (
    <div className="filter-chip-row">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          size="small"
          color="primary"
          variant="outlined"
          onDelete={chip.onDelete}
        />
      ))}
      <button type="button" className="clear-filters-link" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
