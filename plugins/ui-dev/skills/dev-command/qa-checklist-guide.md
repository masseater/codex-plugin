# Manual QA Checklist Generation Guide

Generate a QA checklist for manual human verification based on the screen map.

## What to Cover

For each screen in the screen map:

1. **Transition behavior**: Verify all transition paths manually
2. **Error cases**: Validation errors, API errors, network errors
3. **Hover/focus states**: States of interactive elements
4. **Layout with real data**: Long text, empty data, large datasets
5. **Responsive**: Mobile, tablet, desktop

## Output Format

```markdown
## QA Checklist: {flowName}

### {screenName}

- [ ] Default display is correct
- [ ] Transition to {target} works
- [ ] {validation} error display is correct
- [ ] Loading state is displayed
- [ ] Tab key focus navigation works
- [ ] Layout doesn't break with long text
```
