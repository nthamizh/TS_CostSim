# CostSimulator — Sample Data Templates

One CSV per ETL target table, ready to upload and load. Each CSV
matches the exact column names the ETL handler expects.

---

## How to load data

**1. Upload the CSV to Platform file storage**
   Go to Platform → My Files → Upload → select the `.csv` file.
   After uploading, click ⋮ → **Copy file ID**.

**2. Create a Scheduler job**
   Platform → Scheduler → New job:
   - **Job type**: ETL
   - **Webhook URL**: `http://costsim-api:4002/v1/jobs/etl-handler`
   - **Job config** (see table below for each file):
     ```json
     {
       "targetTable": "eligibility",
       "sourceFileId": "<paste-file-id-here>"
     }
     ```
   `enterpriseId` is **optional** — if omitted, the ETL uses the
   enterprise associated with the job's creator automatically.
   Only needed for platform admins loading data for a specific enterprise.

**3. Click "Run now"** → check the bell notification for the result.
   Each job does a **full replace** for that enterprise + table —
   existing rows are deleted and replaced in a single transaction,
   so a failed job leaves the old data intact.

---

## Table reference

| CSV file | targetTable | Required jobConfig |
|----------|-------------|-------------------|
| `lov.csv` | `list_of_values` | `{"targetTable":"list_of_values","sourceFileId":"<id>"}` |
| `valid_combinations.csv` | `valid_combinations` | `{"targetTable":"valid_combinations","sourceFileId":"<id>"}` |
| `eligibility.csv` | `eligibility` | `{"targetTable":"eligibility","sourceFileId":"<id>"}` |
| `department.csv` | `department` | `{"targetTable":"department","sourceFileId":"<id>"}` |
| `person.csv` | `person` | `{"targetTable":"person","sourceFileId":"<id>"}` |
| `person_element.csv` | `person_element` | `{"targetTable":"person_element","sourceFileId":"<id>"}` |
| `position.csv` | `position` | `{"targetTable":"position","sourceFileId":"<id>"}` |
| `job.csv` | `job` | `{"targetTable":"job","sourceFileId":"<id>"}` |
| `payroll.csv` | `payroll` | `{"targetTable":"payroll","sourceFileId":"<id>"}` |
| `fast_formula.csv` | `fast_formula` | `{"targetTable":"fast_formula","sourceFileId":"<id>"}` |
| `iac_ppg.csv` | `iac_ppg` | `{"targetTable":"iac_ppg","sourceFileId":"<id>"}` |
| `iac_seg.csv` | `iac_seg` | `{"targetTable":"iac_seg","sourceFileId":"<id>"}` |

**Recommended load order** (for referential consistency in the UI):
1. `list_of_values` — all dropdown categories
2. `valid_combinations` — depends on Legal Employer values
3. `eligibility`, `department`, `position`, `job`, `payroll` — independent
4. `person` → `person_element`
5. `fast_formula`, `iac_ppg`, `iac_seg` — overrides last

---

## CSV format rules

- **Header row required** — column names must exactly match those below
- **Null values** — leave the cell empty or write `null` (case-insensitive)
- **Encoding** — UTF-8 or UTF-8 BOM (Excel's default save)
- **Dates** — `YYYY-MM-DD` format. Use `4712-12-31` for open-ended end dates

---

## Column reference

### lov — List of Values
`category, value, sortOrder`
- `category`: "Legal Employer" | "People Group 1" | "People Group 2" | "People Group 3" | "Agency" | "Contract Clause"
- `sortOrder`: integer, controls dropdown display order

### valid_combinations
`legalEmployer, peopleGroup1, peopleGroup2, peopleGroup3`

### eligibility
`elementName, eligibility, accountType, eligibilityStartDate, eligibilityEndDate,`
`legalEmployer, peopleGroup1, peopleGroup2, peopleGroup3, seg1..seg9`
- `accountType`: exactly "Cost Account" or "Offset Account"

### department
`deptName, effStartDate, effEndDate, percentage, seg1..seg9`
- `percentage`: 100 for single-line, less for split costing (multiple rows per dept)

### person
`personNumber, assignmentNumber, personType, department, personAgency,`
`legalEntity, peopleGroup, percentage, parStartDate, parEndDate, seg1..seg9`
- `peopleGroup`: pipe-separated → `Staff|Regular|Professional`

### person_element
Same as `person` plus `element` column (Oracle element name)

### position
`positionCode, positionName, effStartDate, effEndDate, percentage, seg1..seg9`

### job
`jobCode, jobName, effStartDate, effEndDate, percentage, seg1..seg9`

### payroll
`payrollDefinition, effStartDate, effEndDate, percentage, seg1..seg9`

### fast_formula
`key, element, priorityRank, legalEntity, peopleGroup1, peopleGroup2,`
`personAgency, personType, contractClause, startDate, endDate, seg1..seg9`
- `priorityRank`: lower = higher priority; use 99 for catch-all default

### iac_ppg — Interagency People Group overrides
`legalEntity, peopleGroupSegment, element, accountType, isActive, startDate, endDate, seg1..seg9`
- `accountType`: "Cost" | "Offset" | "Both"
- `isActive`: `true` or `false`

### iac_seg — Interagency Segment overrides
`legalEntity, accountType, segment, oldValue, newValue, startDate, endDate`
- `segment`: "Segment 1" through "Segment 9"
