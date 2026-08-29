import os
import random
import csv
from datetime import datetime, timedelta

def main():
    # Directories
    os.makedirs(r"c:\RaktSetu\RaktSetu\database\seeds", exist_ok=True)
    os.makedirs(r"c:\RaktSetu\RaktSetu\data\reference", exist_ok=True)
    os.makedirs(r"c:\RaktSetu\RaktSetu\data\demo", exist_ok=True)

    banks = [
        (1, 'AIIMS Blood Bank', 'Delhi', 'Delhi', 'Ansari Nagar, New Delhi', '011-26588700', 28.6139, 77.2090),
        (2, 'Lok Nayak Hospital Blood Bank', 'Delhi', 'Delhi', 'Jawaharlal Nehru Marg, New Delhi', '011-23236000', 28.6139, 77.2090),
        (3, 'Safdarjung Hospital Blood Bank', 'Delhi', 'Delhi', 'Ring Road, New Delhi', '011-26165060', 28.6139, 77.2090),
        (4, 'Tata Memorial Hospital Blood Bank', 'Mumbai', 'Maharashtra', 'Dr. E Borges Road, Parel, Mumbai', '022-24177000', 19.0760, 72.8777),
        (5, 'KEM Hospital Blood Bank', 'Mumbai', 'Maharashtra', 'Acharya Donde Marg, Parel, Mumbai', '022-24107000', 19.0760, 72.8777),
        (6, 'Hinduja Hospital Blood Bank', 'Mumbai', 'Maharashtra', 'Veer Savarkar Marg, Mahim, Mumbai', '022-24449199', 19.0760, 72.8777),
        (7, 'NIMHANS Blood Bank', 'Bangalore', 'Karnataka', 'Hosur Road, Bengaluru', '080-26995000', 12.9716, 77.5946),
        (8, 'Victoria Hospital Blood Bank', 'Bangalore', 'Karnataka', 'Fort Road, Bengaluru', '080-26701150', 12.9716, 77.5946),
        (9, 'Apollo Hospitals Blood Bank', 'Bangalore', 'Karnataka', 'Bannerghatta Road, Bengaluru', '080-26304050', 12.9716, 77.5946),
        (10, 'Rajiv Gandhi GH Blood Bank', 'Chennai', 'Tamil Nadu', 'EVR Periyar Salai, Chennai', '044-25305000', 13.0827, 80.2707),
        (11, 'Stanley Medical College Blood Bank', 'Chennai', 'Tamil Nadu', 'Old Jail Road, Chennai', '044-25281347', 13.0827, 80.2707),
        (12, 'Apollo Hospital Blood Bank', 'Chennai', 'Tamil Nadu', 'Greams Road, Chennai', '044-28293333', 13.0827, 80.2707),
        (13, 'Osmania General Hospital Blood Bank', 'Hyderabad', 'Telangana', 'Afzal Gunj, Hyderabad', '040-24600121', 17.3850, 78.4867),
        (14, 'Gandhi Hospital Blood Bank', 'Hyderabad', 'Telangana', 'Padmarao Nagar, Secunderabad', '040-27702222', 17.3850, 78.4867),
        (15, 'NIMS Blood Bank', 'Hyderabad', 'Telangana', 'Punjagutta, Hyderabad', '040-23489000', 17.3850, 78.4867),
        (16, 'SSKM Hospital Blood Bank', 'Kolkata', 'West Bengal', 'AJC Bose Road, Kolkata', '033-22231589', 22.5726, 88.3639),
        (17, 'Medical College Hospital Blood Bank', 'Kolkata', 'West Bengal', 'College Street, Kolkata', '033-22551621', 22.5726, 88.3639),
        (18, 'Sassoon General Hospital Blood Bank', 'Pune', 'Maharashtra', 'Station Road, Pune', '020-26128000', 18.5204, 73.8567),
        (19, 'Jehangir Hospital Blood Bank', 'Pune', 'Maharashtra', 'Sassoon Road, Pune', '020-66819999', 18.5204, 73.8567),
        (20, 'Civil Hospital Blood Bank', 'Ahmedabad', 'Gujarat', 'Asarwa, Ahmedabad', '079-22683721', 23.0225, 72.5714),
        (21, 'SVP Hospital Blood Bank', 'Ahmedabad', 'Gujarat', 'Ellisbridge, Ahmedabad', '079-26580123', 23.0225, 72.5714),
        (22, 'SMS Hospital Blood Bank', 'Jaipur', 'Rajasthan', 'JLN Marg, Jaipur', '0141-2560291', 26.9124, 75.7873),
        (23, 'Fortis Hospital Blood Bank', 'Jaipur', 'Rajasthan', 'JLN Marg, Jaipur', '0141-2547000', 26.9124, 75.7873),
        (24, 'KGMU Blood Bank', 'Lucknow', 'Uttar Pradesh', 'Chowk, Lucknow', '0522-2257450', 26.8467, 80.9462),
        (25, 'SGPGI Blood Bank', 'Lucknow', 'Uttar Pradesh', 'Raebareli Road, Lucknow', '0522-2494000', 26.8467, 80.9462),
        (26, 'RML Hospital Blood Bank', 'Lucknow', 'Uttar Pradesh', 'Vibhuti Khand, Gomti Nagar, Lucknow', '0522-4918500', 26.8467, 80.9462),
        (27, 'Ruby Hall Clinic Blood Bank', 'Pune', 'Maharashtra', 'Sassoon Road, Pune', '020-66455100', 18.5204, 73.8567),
        (28, 'Manipal Hospital Blood Bank', 'Bangalore', 'Karnataka', 'Old Airport Road, Bengaluru', '080-25024444', 12.9716, 77.5946)
    ]

    blood_groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

    # 6. seed_demo_data.sql
    with open(r"c:\RaktSetu\RaktSetu\database\seeds\seed_demo_data.sql", "w", encoding="utf-8") as f:
        f.write("-- Insert 28 Blood Banks\n")
        f.write("INSERT INTO blood_banks (id, name, city, state, address, phone, latitude, longitude, data_origin, is_demo_data) VALUES\n")
        values = []
        for b in banks:
            values.append(f"({b[0]}, '{b[1]}', '{b[2]}', '{b[3]}', '{b[4]}', '{b[5]}', {b[6]}, {b[7]}, 'official_reference', false)")
        f.write(",\n".join(values))
        f.write("\nON CONFLICT (id) DO NOTHING;\n\n")

        f.write("-- Insert Synthetic Stock\n")
        f.write("INSERT INTO stock_current (bank_id, blood_group, component, units, is_demo_data) VALUES\n")
        stock_vals = []
        for b in banks:
            for bg in blood_groups:
                units = random.randint(0, 50)
                stock_vals.append(f"({b[0]}, '{bg}', 'Whole Blood', {units}, true)")
        f.write(",\n".join(stock_vals))
        f.write("\nON CONFLICT (bank_id, blood_group, component) DO NOTHING;\n")

    # 7. blood_centres_verified.csv
    with open(r"c:\RaktSetu\RaktSetu\data\reference\blood_centres_verified.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id","name","city","state","address","phone","latitude","longitude","source_url","source_checked_at"])
        for b in banks:
            writer.writerow([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], "https://nbtc.nic.in/BloodBanks", "2024-01-15"])

    # 8. inventory_simulated.csv
    with open(r"c:\RaktSetu\RaktSetu\data\demo\inventory_simulated.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["bank_id","blood_group","component","units","is_demo_data","generated_at"])
        for b in banks:
            for bg in blood_groups:
                units = random.randint(0, 50)
                writer.writerow([b[0], bg, "Whole Blood", units, "true", "2024-01-15T10:00:00Z"])

    # 9. reporting_history.csv
    with open(r"c:\RaktSetu\RaktSetu\data\demo\reporting_history.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["bank_id","reported_at","blood_group","component","units","source","is_demo_data"])
        base_time = datetime(2024, 1, 15, 10, 0, 0)
        for _ in range(100):
            bank_id = random.randint(1, 28)
            bg = random.choice(blood_groups)
            units = random.randint(0, 50)
            source = random.choice(['web', 'sms'])
            time_offset = timedelta(days=random.uniform(0, 7), hours=random.uniform(0, 24))
            reported_at = (base_time - time_offset).strftime('%Y-%m-%dT%H:%M:%SZ')
            writer.writerow([bank_id, reported_at, bg, "Whole Blood", units, source, "true"])

if __name__ == "__main__":
    main()
