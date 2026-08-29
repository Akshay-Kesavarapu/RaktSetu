# Demo Data Disclosure

## Important Notice

The VITALS project is a demonstration of a software architecture and is **NOT** connected to live, real-time blood bank inventory systems. 

### What is Real?
The structural metadata for blood centres (names, cities, states, addresses, generic contact numbers) is sourced from the public registry of the National Blood Transfusion Council (NBTC). This provides a realistic geographic distribution for the demonstration.

### What is Synthetic?
**ALL inventory data, availability numbers, and reporting timestamps are entirely synthetic.** 
- No real blood stock levels are represented in this system.
- All updates, history, and available units are generated randomly or simulated for the purpose of demonstrating the software's capabilities.

### Why Synthetic Data?
We use synthetic data for inventory to:
1. Ensure there is zero risk to patients who might mistake demo data for real availability.
2. Protect the privacy and operational security of real blood banks.
3. Adhere to ethical software development practices during hackathons and demonstrations.

### Real-World Application
In a production environment, this system would integrate securely with partner blood banks via authenticated APIs and authorized staff input. The database schema explicitly tracks the provenance of data using the `data_origin` enum and the `is_demo_data` boolean flag to ensure clear separation between real and synthetic records.

**Do not use any inventory data in this system for real medical decisions.**
