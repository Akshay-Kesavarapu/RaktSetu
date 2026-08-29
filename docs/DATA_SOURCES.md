# Data Sources

## Data Provenance

To demonstrate the VITALS system safely and effectively, we utilize a mix of real and synthetic data. 

### Real Data
- **What is real**: Blood bank names, cities, states, addresses, phone numbers (formatted generic), and approximate coordinates.
- **Source**: National Blood Transfusion Council (NBTC) public registry.
- **Identification**: Marked with `data_origin = 'official_reference'`.

### Synthetic Data
- **What is synthetic**: All inventory numbers (units available), all reporting history timestamps, and units reported.
- **Why**: To avoid false claims of blood availability and protect patient/facility data privacy.
- **Identification**: Marked with `is_demo_data = true` and `data_origin = 'synthetic_demo'` or `'partner_reported'` (if generated as a mock user action).

### `data_origin` Enum Values
1. `official_reference`: Sourced from official public registries (e.g., NBTC).
2. `synthetic_demo`: Auto-generated for demonstration purposes.
3. `partner_reported`: Data reported by blood bank staff (real or simulated).

### Acknowledgement
We acknowledge the National Blood Transfusion Council (NBTC) for providing the public registry of blood centres used for the structural foundation of our demo data.
