# Simple Inventory — prototype

A simple stock book for work done in **RABs** (work plans). Everything that is bought or used is for a RAB: the admin buys the items for a RAB, the employees report what they used on it with a photo, the admin approves those reports, and the wages are paid per RAB. The menu is a sidebar on the left: **Input**, **Work reports**, **RAB**, **Report**, and under **Master data** the lists of **Items**, **Employees**, **Units** and **Users**. On a small screen the sidebar is hidden and opens with the menu button (three lines) at the top left.

Plain HTML, CSS and JavaScript. No build step, no server, no libraries. Double-click `index.html` to open it. Data is saved in the browser's `localStorage`. The first time you open it, sample data is loaded.

## Users and roles

You sign in first. There are three kinds of users, and each sees only its own menu. Opening another page's address sends you back to your own home page.

| Role | Menu | What they do |
|---|---|---|
| **Supervisor** | Report, RAB | Reads the report and its charts. Sees the RABs with their purchases, work reports, photos and wages, and the stock card of any item, but cannot change anything. Can export and print. Starts on the Report. |
| **Admin** | Input, Work reports, RAB, Report, Master data (Items, Employees, Units, Users) | Makes the RABs (which items and how much, and which employees do the work with their wage), buys the items for them, enters adjustments after a stock count, approves, corrects or rejects the work reports the employees send, pays the wages from the RAB page, and keeps the master data and the user accounts. Sees the report too. Starts on Input. Does not send work reports. |
| **Pegawai** (employee) | Report work | Sees the RABs they work on, with their wage and the items, and reports what they did: the item and quantity used, the work done and a photo. Sees their own work reports with the admin's decision: waiting, approved (and whether the admin changed it) or rejected, with the reason. |

- **Demo accounts** are listed on the sign-in page: `supervisor` / `supervisor123`, `admin` / `admin123`, and one per sample employee (`budi` / `budi123`, `siti` / `siti123`, `andi` / `andi123`). Data saved before accounts existed gets the same demo accounts the first time it is opened: one per active employee, named after their first name. An account leaves that list once its password is changed.
- **Users** (admin, under Master data): username, role, name, password, active. A Pegawai account is tied to one employee from the master data, and an employee can have only one account. Inactive users cannot sign in.
- **Safeguards**: there is always at least one active admin. You cannot delete your own account, change your own role or make yourself inactive. An employee with an account cannot be deleted until the account is.
- **Your name** is at the bottom of the sidebar. Click it for **Change password**, the **language** (Indonesia / English) and **Sign out**. The admin also has **Data…** there (see *Data* below), and can set a new password for anyone in the Users list. The language can also be chosen on the sign-in page.
- **A Pegawai report** is always made on an item of a RAB they work on (see *RAB* below) and saved as a work report in that employee's own name. It **waits for the admin's approval** (see *Work reports and approval* below). The work description and the photo are required, the date cannot be in the future or before the RAB, and the quantity cannot be more than what is left of that item on the RAB or more than the stock.
- **Photos** are made smaller in the browser (longest side 1,280 px, JPEG) and kept in the browser's IndexedDB. The admin can also attach, replace or remove a photo on any entry, for example the receipt of a purchase. Photos are not part of the exports.
- **This is not real security.** Everything, including the accounts, is stored in this one browser, so the roles only separate what each person sees on this device. Passwords are stored as a salted hash, not as plain text. Data and photos entered on one device do not appear on another: a phone and a PC each have their own copy until there is a server.

## Pages

| Page | What it does |
|---|---|
| **Input** | Choose **Purchase** or **Adjustment**. A **purchase** is always for an open RAB: choose the RAB first, and the item list shows only its items. It has the price per unit (the last one is filled in), the supplier, the invoice number and a photo of the receipt. An **adjustment** is for a stock count (+ found, − missing or damaged) and is not on a RAB. The side panel shows the item's stock, average cost and last purchase price on the chosen date, its line on the RAB (planned, bought, used, waiting for approval, left), and what the open RABs still need of it, marked **Short** when the stock is not enough. **Latest entries** lists the last six. An entry keeps its type when it is changed. Work reports are not entered here: the employees send them. |
| **Work reports** | The admin's list of the reports the employees sent, with a search, a RAB filter and a status filter that starts on **Waiting**. The menu shows how many are waiting. **Approve** and **Reject** are on each waiting row. Click a report to check it on its own page: the RAB, item, date, quantity, work done and photo can be corrected there before **Approve**, and the side panel shows the stock before the report and the room left on the RAB line. See *Work reports and approval* below. |
| **RAB** | The list of work plans with their progress, and one page per RAB with its costs, employees and wages, items, purchases and work reports (with their status, and Approve / Reject for the admin). The page opens to be read: the admin buys, approves and pays from there, and changes the RAB itself with **Edit**. The supervisor reads the same page. See *RAB* below. |
| **Report work** | The Pegawai page, made for a phone: first a short form (RAB item, date, quantity, work done, photo), then one card per open RAB they work on (their wage, who they work with, and the items with planned, reported and left; reported includes what is still waiting for approval), and the list of their own work reports with their status. On a phone the lists show as cards, so nothing runs off the screen. |
| **Report** | Pick a period (or *This month / Last month / This year*). Six tiles show purchases, material used (the cost of the approved work reports at moving average cost), wages paid, total cost (material used + wages paid), stock value and stock adjustments. The material tile also says how many reports of the period are still waiting for approval: they are not in the figures yet. Four **charts** follow (see below). **RAB costs** shows, per RAB, the purchases, material used, wages paid and total cost in the period. Click a row to open the RAB. **Stock on hand** lists the stock at the end of the period. **Stock movement** shows opening + bought − used ± adjustment = closing per item. **Wages per employee** lists what each employee was paid in the period. Click an item's name to open its stock card. Use **Export** to save the report, or **Print** for a clean printout. |
| **Stock card** | One item: what is on hand, its value and average cost, what the open RABs still need of it, and every purchase, approved work report and adjustment with the stock after each, newest first. Opened by clicking an item's name in Items or in the Report (and on a RAB page, for the supervisor). The admin clicks an entry to change it; a work report opens on its review page. ✕ deletes a purchase or an adjustment (a work report is rejected instead). **Export** and **Print** give the stock card as a ledger. |

There is no separate list of all transactions or of all wage payments any more: entries are found on their RAB or on the stock card of their item, work reports on the Work reports page, and the totals are in the Report.

## Charts

The Report page shows four charts between the tiles and the tables. They follow the chosen period.

| Chart | What it shows |
|---|---|
| **Stock value trend** | Value of all stock over the period, as a line. |
| **Purchases and material used** | Purchases and the cost of the material used, side by side over the period, as columns. |
| **Stock value by item** | The items holding the most value at the end of the period, largest first. |
| **Cost by RAB** | Material used and wages paid per RAB in the period, largest total first. |

- The two charts over time are grouped **per day** for a period up to 31 days, **per week** up to about six months, **per month** up to about three years, and **per year** beyond that. They start at the first transaction, so "This year" does not show empty months before it.
- *Stock value by item* and *Cost by RAB* show the **eight largest**. The rest are added up as *Other*.
- **Hover** over a chart (or tab to it and use the arrow keys) to read exact values. **Table** under the two charts over time shows the same figures as a table. For the other two charts, the tables below hold the figures.
- Each figure keeps its colour in every chart: stock value blue, purchases orange, material used green, wages yellow. The colours are checked for colour-blind readers in light and dark mode.
- Charts are drawn by `js/charts.js` in plain HTML and SVG. They print with the report. **Export** (Excel, PDF, image, CSV) contains the tables only, not the charts.

## Master data

**Master data** in the sidebar has the lists below (and **Users**, see above). Each one has a search box, an add button, and a form that opens when you click a row.

| List | Fields | Notes |
|---|---|---|
| **Items** (Barang) | Code, name, unit, note, active | The code is suggested (`BRG-001`, `BRG-002`…) and can be changed or left empty. The list also shows today's stock, and an item's name opens its stock card. The form has **New unit** to add a unit on the spot. New items can also be added from a RAB with **New item**. |
| **Employees** (Pegawai) | Employee no. (NIP), name, department, active | Chosen on a RAB as the employees who do the work, and on a work report. The list shows how many work reports each one has. |
| **Units** (Satuan) | Name, note | Shows how many items use each unit. |

- **Names** of items and units must be unique (upper/lower case and extra spaces are ignored, so `pen` and ` PEN ` are the same). Item codes and employee numbers must be unique when filled in. Two employees may have the same name.
- **Renaming** an item, unit or employee changes it everywhere: old entries, RABs, reports and exports.
- **Deleting** is only possible while a record is unused. A unit used by an item, an item on a RAB or with entries, or an employee on a RAB, with work reports, payments or an account cannot be deleted. Make the item or employee **inactive** instead: it stays where it is used, but cannot be chosen for anything new.
- **Changing an item's unit** only changes the label. Quantities already entered are not converted.
- **Older data** from before master data existed is converted the first time the page opens: every item name and unit used in a transaction becomes a master record.

## RAB (work plan)

A RAB (*Rencana Anggaran Biaya*) is the plan for a piece of work: which items will be used and how much of each, and which employees do the work, with one wage each. Everything that is bought or used is for a RAB.

1. **The admin makes a RAB** under **RAB → New RAB**: number (suggested `RAB-001`, `RAB-002`…), date, the work or project and a note, then two lists:
   - **Employees and wages**: who works on it, and **one wage per employee for the whole RAB**.
   - **Items**: each item and its **planned quantity**. An item is not tied to an employee: **every employee on the RAB can use every item**. Each item appears once. **New item** adds an item to the master data and puts it on a new line.

   After saving, the RAB's page opens.

   The RAB's page opens to be read. **Edit** at the top opens the same form again (number, date, status, work, note and the two lists), with **Delete** at the bottom. **Save changes** and **Cancel** go back to the page.
2. **Buying**: **+ Purchase** on the RAB page (or Input → Purchase) for an item of the RAB: quantity, price per unit, supplier, invoice number and a photo of the receipt. More than planned may be bought.
3. **Using**: the employees report their work on **Report work**. The admin approves each report on **Work reports** or on the RAB page. An approved report lowers the stock and counts as used on its RAB item.
4. **Paying**: **Pay** next to an employee, or **Pay wages…** for everyone not paid yet. See *Wages* below.

**The RAB page** shows:

- On top: the number with its status (*In progress*, *Complete* or *Closed*), the work, the date and the note.
- Three tiles: **Planned cost** (the estimated material at today's average cost + the wages), **Cost so far** (material used + wages paid) and **Bought for this RAB**.
- **Employees and wages**: each employee's wage, number of work reports, and whether they are paid, with **Pay** or **Edit**.
- **Items**: per item the planned quantity, what was **bought** for the RAB, what was **used** (approved reports, with **+ waiting** under it for reports not approved yet), what is **left** to report, what is **in stock** today, and the estimated cost. While the RAB is open, **Short** shows how much is missing when the waiting reports and what is left need more than the stock.
- **Purchases** and **Work reports**, with their photos. Work reports show their status, and the admin approves or rejects the waiting ones here too. The admin clicks a purchase or a report to change it.

**One shared stock.** What is bought for one RAB and not used stays in stock, and any later RAB can use it. In the sample data, the folders, pens and tape bought for RAB-001 are used again on RAB-002 and RAB-003. The material cost of a RAB is what its work reports used, at moving average cost, not what was bought for it.

- **Progress**: an item is done when everything planned is reported and approved. The list shows *In progress*, *Complete* (all items done) or *Closed*, and how many reports are waiting.
- **Limits**: a work report cannot be more than what is left of the item on the RAB, whoever reports it; reports waiting for approval count too. The admin can raise the quantity if more is needed. A purchase has no such limit. Only employees on the RAB can report on it.
- **Closing**: set the status to *Closed* to stop purchases and reports. Employees only see open RABs. It can be opened again.
- **Dates**: purchases, work reports and wage payments cannot be dated before the RAB, or after today. The RAB's date cannot move past its first purchase, report or payment.
- **Changing a RAB** that already has purchases or reports: an item's quantity can go up, or down to what is reported (approved and waiting), but the item stays and cannot be removed. An employee who has reported work (approved or waiting) or is paid on the RAB cannot be removed; their wage can still change. A RAB with purchases, reports or payments cannot be deleted. Close it instead.
- **Changing a purchase** (admin, from the RAB page, the stock card or Latest entries): it stays on a RAB. Its item can change to another item of the same RAB, or it can move to another open RAB, with the same checks as a new one. Work reports are changed on their review page (see below).
- **Est. cost** on the RAB is quantity × today's average cost of the item. It is a guide only; the real cost of each report is in the stock card and the report.
- Items and employees used in a RAB cannot be deleted. Make them inactive instead. Inactive items and employees cannot be added to a RAB.
- **Older data**: RABs saved when each line had its own employee and wage are converted once: the employees become the RAB's employees with their line wages added up, and lines of the same item are merged.

## Work reports and approval

Only the employees send work reports. The admin checks each one and approves it, corrects it, or rejects it.

- **Waiting**: a report that was just sent. It is **not in the stock or the costs yet**, but it already holds its quantity on the RAB line, so the employees cannot report more than planned between them. Waiting reports must also fit the stock together, so one employee's report cannot take what another one is waiting for.
- **Approve**: on the Work reports list, on the RAB page, or on the report's own page. The report goes into the stock and counts as used and in the costs. It is put in order at the moment it is approved, so a purchase entered earlier that day comes before it. If the stock is not enough (for example after a stock count), approving fails with the reason: buy more first, or correct or reject the report.
- **Correct**: open the report, change the RAB (only RABs the employee works on), item, date, quantity, work done or photo, and **Approve**. The employee keeps their name on it and sees **Changed by the admin**.
- **Reject**: needs a reason, which the employee sees in their list. The report leaves the stock (if it was approved) and no longer holds anything on the RAB line, but it is kept as it is and cannot be changed again. The employee sends a new report instead.
- **An approved report** can still be corrected (**Save changes**) or rejected later. Work reports are not deleted.
- A report waiting on a RAB that has been closed can still be approved or rejected; no new reports can be sent on it.
- The decision keeps who made it and when, shown on the report's page.
- **Older data**: work reports saved before approvals existed count as approved.

## Wages

Wages are paid **per RAB**, from the RAB page. There is no separate salaries page.

- **The wage** is set once per employee on each RAB, for the whole work. The employee sees it on **Report work**.
- **Pay** next to an employee opens their payment: the date it was paid, the wage (filled in from the RAB), allowance or bonus, deduction and a note. Total = wage + allowance − deduction, and must be more than 0. **Edit** changes the payment or deletes it.
- **Pay wages…** adds, in one step, a payment for every employee on the RAB who has a wage and is not paid yet for it. Paying does not wait for the work to be complete; the RAB page shows the progress next to the wages.
- **One payment per employee per RAB.** Put a bonus in the allowance field of the same payment.
- Changing a wage on the RAB after it is paid does not change the payment. Edit the payment if it should.
- **In the report**, a wage counts on the date it was **paid**. *Wages per employee* lists what each employee was paid in the period, and *RAB costs* splits the same wages per RAB. **Total cost** is material used + wages paid. It is not a full profit and loss: other costs such as rent or electricity are not recorded, and nothing is sold.
- An employee who has payments cannot be deleted. Make them inactive instead.
- **Older data**: payments from when salaries were monthly have no RAB. They are kept and still count in the report's wages, but they are not on any RAB page.

## Data (admin)

**Data…** in the menu under your name, at the bottom of the sidebar, has two actions:

- **Load sample data** replaces all data with the sample: three RABs with their purchases, work reports and wages. RAB-001 is finished, closed and paid; RAB-002 is complete, with Andi paid and Budi not yet; RAB-003 is in progress, not paid, short of tape, with two work reports waiting for approval and one rejected (Siti reported pens for labels printed on paper, then reported the paper).
- **Delete all data** deletes the RABs, purchases, work reports, wage payments, photos and master data, and the accounts of employees. The admin and supervisor accounts stay.

## Export

The **Export** menu on the Report and on a stock card saves what is on screen. The report uses the chosen period.

| Format | What you get |
|---|---|
| **Excel (.xlsx)** | A real workbook. Numbers and dates are stored as values, not text, so you can sum and sort them. Header rows are frozen. The report has five sheets: *Summary*, *RAB*, *Stock*, *Movement* and *Wages*. |
| **PDF** | A4 landscape with a title, period, created time, the logo and page numbers. The header row repeats on each page. Wide tables shrink to fit the page width. |
| **Image (.png)** | The whole report or stock card as one sharp image (2×) with the logo, good for chat or email. Very long lists (about 1,000+ rows) are too tall for one image. The app then asks you to use PDF or Excel. |
| **CSV** | Plain numbers (dot decimals), UTF-8. The report gives one CSV per table. |

All of it is generated in the browser by `js/export.js`, without libraries or a server. The PDF uses the built-in Helvetica font, which covers Latin text, including Indonesian and accented letters. Characters outside it, such as Chinese, show as `?` in the PDF only. Excel and PNG show them correctly.

## Rules (kept small on purpose)

- **Purchase**: for an item of an open RAB, quantity > 0, purchase price per unit required (0 is allowed).
- **Work report**: sent by an employee on the RAB, for an item of an open RAB with something left, quantity > 0 and not more than what is left. It has no price: it is valued at the moving average cost. It counts in the stock and the costs only once the admin approves it.
- **Adjustment**: signed quantity (+ found, − missing or damaged), valued at the current average cost. Not on a RAB.
- **Nothing is sold**: there are no selling prices, customers or sales.
- **Items** must exist in the master data and be active. The form accepts the item's name or its code.
- **Costing** uses the moving average, recalculated in date order, so back-dated entries are handled correctly.
- **No negative stock.** A new, edited or deleted entry is rejected if it would push any item below zero on any date. The message says which item, which date and how much was available.
- **Dates** are never after today, and purchases, work reports and payments are not before their RAB.
- **Older entries** from before purchases and use were tied to a RAB stay as they are. They show on the stock card and can be changed without choosing a RAB. Their old selling prices are no longer used.
- **Numbers and dates** follow the language. Indonesian (default) shows `1.234,56` and `28-Okt-2026`, English shows `1,234.56` and `28-Oct-2026`. CSV files use plain numbers.

## Design

- **Logo**: a closed box on a blue tile (`img/logo.svg`), next to the name in the sidebar, on the sign-in page, as the browser tab icon, on printouts, and in the PDF and PNG exports. A phone that adds the app to its home screen uses `img/apple-touch-icon.png`.
- **Colours** are set once at the top of `css/app.css` (`:root`): one blue accent (`#1f5fbf`, the logo's blue), grey text and borders, and green / orange / red only for status (approved, waiting, rejected, short). Dark mode follows the device setting.
- **Layout**: sidebar menu with icons on the left; on a screen under 900 px wide it becomes a drawer behind the menu button. Pages are white cards on a light grey background. Tiles stay plain: a border, a soft shadow and the number as the focal point.
- **Phones**: under 640 px the forms use one column, the report tiles shrink their numbers instead of breaking them, and the lists of the employee page and of the work reports become cards, so nothing runs off the screen.
- **Icons** are simple line drawings written into `js/app.js` (`ICON`), without an icon library.

## Files

```
index.html
img/logo.svg              the logo (also the browser tab icon)
img/apple-touch-icon.png  the logo as a home-screen icon (180×180)
css/app.css
js/i18n.js    language (Indonesian / English) and number/date formatting
js/calc.js    stock maths: moving average, validation, stock, movement, timeline and RAB cost reports, CSV (no DOM)
js/store.js   localStorage, master data (items, employees, units), users and sign-in, RABs with their purchases,
              work reports (and their approval) and wages, their rules, sample data
js/photos.js  photos of entries: shrinks a picture and keeps it in IndexedDB
js/export.js  Excel (.xlsx), PDF, PNG and CSV writers for one "export document" (title, summary, tables)
js/charts.js  the report charts: line / column chart over time and ranked bars, in plain HTML and SVG
js/app.js     sign-in, the menu per role, and the pages
```
