import type { ControlId, MachineId } from "#policy/exercises.ts"

interface Source {
	readonly title: string
	readonly url: string
	readonly pages?: string
}

interface Control {
	/** HOIST's name for the control. */
	readonly label: string
	readonly location: string
	readonly hardware: string
	readonly adjustment: string
	/** What the manufacturer documents about the numbering, and what remains inferred. */
	readonly numberingNote: string
	readonly sources: readonly Source[]
}

interface WeightStack {
	readonly composition: string
	readonly decals: string
	readonly chart: string
	readonly sources: readonly Source[]
}

const hoistSources = {
	downloads: {
		title: "HOIST Customer Downloads, Archived Owner's Manuals",
		url: "https://www.hoistfitness.com/pages/customer-downloads"
	},
	cl2403: {
		title: "HOIST CL-2403 Owner's Manual (June 2000, scanned)",
		url: "https://cdn.shopify.com/s/files/1/0057/5599/4225/files/CL-2403_om.pdf"
	},
	cl2403ManualsLib: {
		title: "HOIST CL-2403 Owner's Manual (ManualsLib copy; chart viewer p. 37)",
		url: "https://www.manualslib.com/manual/879629/Hoist-Fitness-Cl-2403.html"
	},
	d200RevA: {
		title: "HOIST D-200 Owner's Manual, rev A (July 1996)",
		url: "https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-200_om.pdf"
	},
	d200RevB: {
		title: "HOIST D-200 Owner's Manual, rev B (catalog 0600-001, parts distributor mirror)",
		url: "https://www.gympart.com/TSB/Hoist%20Fitness/Dual_Series/D200_Lat_Pulldown,_Mid_Row/S/D200_om.pdf"
	},
	d300RevA: {
		title: "HOIST D-300 Dual 300 Multi-Chest Owner's Manual, rev A",
		url: "https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-300_om.pdf"
	},
	d300RevB: {
		title: "HOIST D-300 Dual 300 Multi-Chest Owner's Manual, rev B (parts distributor mirror)",
		url: "https://www.gympart.com/TSB/Hoist%20Fitness/Dual_Series/D300_Multi,_Chest/S/D300_om.pdf"
	},
	d400: {
		title: "HOIST D-400 Dual 400 Leg Extension / Hamstring Curl Owner's Manual",
		url: "https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-400_om.pdf"
	},
	d400Product: {
		title: "HOIST Dual 400 product page (archived c. 2000)",
		url: "https://web.archive.org/web/20001027121018/http://www.hoistfitness.com:80/Pages/comd400.html"
	},
	d600: {
		title: "HOIST D-600 Dual 600 Lower Back / Abdominals Owner's Manual",
		url: "https://cdn.shopify.com/s/files/1/0057/5599/4225/files/D-600_om.pdf"
	},
	d600Product: {
		title: "HOIST Dual 600 product page (archived c. 2000)",
		url: "https://web.archive.org/web/20001202005300/http://www.hoistfitness.com:80/Pages/comd600.html"
	},
	dualSpecification: {
		title: "HOIST Dual Line Product Specification (archived)",
		url: "https://web.archive.org/web/20001027230644/http://www.hoistfitness.com:80/Pages/cdspec.html"
	},
	dualOverview: {
		title: "HOIST Duals overview (archived)",
		url: "https://web.archive.org/web/20010302173335/http://www.hoistfitness.com:80/Pages/comdual.html"
	}
} as const satisfies Record<string, Source>

const page = (source: Source, pages: string): Source => ({ ...source, pages })

/** HOIST names, hardware and procedures from the owner's manuals, placards and archived specifications. */
export const machineControls = {
	"cl-2403-back-adjuster": {
		label: "Back Adjuster (back pad angle)",
		location: "Back Adjuster Seated Assembly behind the seat back",
		hardware: "curved Range Adjuster Plate with a long pull pin",
		adjustment:
			"Support the unloaded back pad, withdraw the long pull pin, set the back pad angle for full back and pelvis support, and fully re-engage the pin before loading.",
		numberingNote:
			"The installed unit has no printed numbers: hole 1 is the most upright position and each higher number reclines further. The manual's drawing suggests about four usable holes and its decal list has no back-angle number decal.",
		sources: [page(hoistSources.cl2403, "PDF pp. 33–37")]
	},
	"cl-2403-seat-slide-adjuster": {
		label: "Seat Slide Adjuster",
		location: "perforated Seat Slide Adjuster tube beside the seat carriage rails",
		hardware: "perforated tube (16 holes drawn) and its retaining pin; confirm the installed release",
		adjustment:
			"With the carriage controlled, release the seat and set it at the forward starting position with about a 90-degree knee bend and the pelvis supported; re-engage it before loading. HOIST's placard says to slide the seat back to exit.",
		numberingNote:
			"HOIST does not document how this control is counted. The manual draws 16 holes and lists a 1–21 number strip (decal 021-0003089) without showing where it is mounted, so a printed number at the seat is not established.",
		sources: [page(hoistSources.cl2403, "placard PDF p. 35; parts PDF pp. 33–37")]
	},
	"d-200-seat-pad-adjuster": {
		label: "Seat Pad Adjuster",
		location: "chromed telescoping adjuster tube below the seat pad",
		hardware: "numbered adjuster tube and pull pin",
		adjustment:
			"Support the seat, withdraw the pin, set the height (HOIST's placard: lower the seat for taller users), and fully re-engage the pin. Confirm it separately for the pulldown and the row.",
		numberingNote:
			"The manual draws engraved numerals 1–7 with 1 at the top of the tube, which likely means the lowest seat; that direction is inferred from the drawing, not stated by HOIST.",
		sources: [
			page(hoistSources.d200RevB, "PDF p. 11; placard PDF p. 23"),
			hoistSources.d200RevA,
			hoistSources.dualSpecification
		]
	},
	"d-200-thigh-pad-adjuster": {
		label: "Thigh Pad Adjuster",
		location: "thigh pad support above the seated thighs",
		hardware: "numbered adjuster tube and pull pin",
		adjustment:
			"Support the pad, release its pin, bring the pad snugly onto the thighs without painful compression (HOIST's placard: snug for both exercises), and re-engage the pin.",
		numberingNote: "The manual draws numerals 1–4 running top to bottom; direction is inferred from the drawing.",
		sources: [page(hoistSources.d200RevB, "PDF p. 11; placard PDF p. 23"), hoistSources.dualSpecification]
	},
	"d-200-horizontal-chest-pad-adjuster": {
		label: "Horizontal Chest Pad Adjuster",
		location: "horizontal chest pad support in front of the torso",
		hardware: "numbered adjuster tube and pull pin",
		adjustment:
			"Support and release the chest pad, set reach so the chest stays supported with the handles just out of reach (HOIST's placard), and re-engage the pin.",
		numberingNote:
			"The manual draws numerals 1–14 with 1 at the pad end; direction is inferred from the drawing, not stated by HOIST.",
		sources: [page(hoistSources.d200RevB, "PDF p. 11; placard PDF p. 23"), hoistSources.dualSpecification]
	},
	"d-300-seat-pad-adjuster": {
		label: "Seat Pad Adjuster",
		location: "chromed telescoping adjuster tube below the seat pad",
		hardware: "numbered adjuster tube and pull pin",
		adjustment:
			"Support the seat, release the pin, set the height so the horizontal handles travel across mid-sternum, and re-engage it. Keep feet firmly planted.",
		numberingNote:
			"The manual draws numerals 1–7 with 1 at the top of the tube, which likely means the lowest seat; direction is inferred from the drawing.",
		sources: [page(hoistSources.d300RevB, "PDF p. 9; placard PDF p. 20"), hoistSources.d300RevA]
	},
	"d-300-back-pad-adjuster": {
		label: "Back Pad Adjuster",
		location: "sliding back pad support behind the torso",
		hardware: "numbered adjuster tube and pull pin",
		adjustment:
			"Support the pad, release its pin, set the back pad for the desired pre-stretch with shoulders supported (HOIST's placard), and re-engage it. The chest press uses the horizontal grip.",
		numberingNote:
			"The manual draws numerals 1–7 with 1 at the pad end, likely the farthest-back position; the parts list confusingly names this sliding weldment the Chest Pad Adjuster.",
		sources: [page(hoistSources.d300RevB, "PDF p. 9; placard PDF p. 20"), hoistSources.d300RevA]
	},
	"d-400-back-adjuster": {
		label: "Back Adjuster",
		location: "telescoping back pad tube behind the seat",
		hardware: "gas spring with a remote pull-pin handle",
		adjustment:
			"Pull the remote handle and let the gas spring move the supported back pad until each knee aligns with the arm pivot while the back stays supported; release the handle and confirm the pin engaged.",
		numberingNote:
			"HOIST's Dual specification describes engraved numbers on the adjuster tubes. The manual drawing shows about four holes; a reseller lists five.",
		sources: [
			page(hoistSources.d400, "assembly drawings, PDF pp. 2–6, 9–10"),
			hoistSources.d400Product,
			hoistSources.dualSpecification
		]
	},
	"d-400-range-of-motion": {
		label: "Range of Motion Adjustment",
		location: "Cam Adjust Plate at the moving arm's pivot",
		hardware: "cam adjust plate and its pull pin",
		adjustment:
			"Keep the stack down and support the moving arm. Release the cam, choose a start with a slight knee bend, and fully re-engage it.",
		numberingNote: "HOIST's Dual specification states that all range-of-motion positions are numbered.",
		sources: [
			page(hoistSources.d400, "assembly drawings, PDF pp. 2–6, 9–10"),
			hoistSources.d400Product,
			hoistSources.dualSpecification
		]
	},
	"d-400-leg-length": {
		label: "Leg Length Adjustment",
		location: "Adjustable Roller Assembly on a Range Adjust Plate on the moving arm",
		hardware: "range adjust plate (about 7 holes drawn) and its pull pin",
		adjustment:
			"Support and release the roller, place the pad at the bottom of the calves above the heels, and re-engage it. Confirm it independently of the range of motion.",
		numberingNote: "HOIST does not document numbering for this plate; the drawing shows about seven holes.",
		sources: [page(hoistSources.d400, "assembly drawings, PDF pp. 2–6, 9–10"), hoistSources.d400Product]
	},
	"d-400-thigh-brace": {
		label: "Thigh Brace Adjustment",
		location: "Adjustable Roller Assembly on a Range Adjust Plate at the front of the seat",
		hardware: "range adjust plate (about 7 holes drawn) and its pull pin",
		adjustment:
			"Support the thigh brace, release its adjustment, bring it snugly onto the thighs without painful compression, and re-engage it.",
		numberingNote: "HOIST does not document numbering for this plate; the drawing shows about seven holes.",
		sources: [page(hoistSources.d400, "assembly drawings, PDF pp. 2–6, 9–10"), hoistSources.d400Product]
	},
	"d-600-range-of-motion": {
		label: "Range of Motion Adjustment",
		location: "Cam Adjust Plate beside the moving arm's pivot",
		hardware: "cam adjust plate with a long T-handle pull pin",
		adjustment:
			"Keep the stack down and support the moving arm. Pull the T-handle, choose a conservative pain-free starting arc, and verify full engagement. Confirm it separately for lower back and abdominals.",
		numberingNote: "HOIST's Dual specification states that all range-of-motion positions are numbered.",
		sources: [
			page(hoistSources.d600, "assembly drawings, PDF pp. 3–8"),
			hoistSources.d600Product,
			hoistSources.dualSpecification
		]
	},
	"d-600-foot-rest": {
		label: "Foot Rest",
		location: "Footrest Assembly sliding square tube in front of the seat",
		hardware:
			"sliding square tube (about 11 holes drawn); the drawing shows a spring T-handle pull pin while the parts list names that callout a chain-link connector, so identify the installed retention",
		adjustment:
			"Adjust the unloaded foot rest to brace the lower body without sliding, verify its retention before loading, and confirm it separately for lower back and abdominals. The foot rest is not a resistance selector.",
		numberingNote: "HOIST does not document numbering for the foot rest tube; the drawing shows about eleven holes.",
		sources: [page(hoistSources.d600, "assembly drawings, PDF pp. 3–8"), hoistSources.d600Product]
	}
} as const satisfies Record<ControlId, Control>

export const weightStackRule =
	"Selector position = plate number counted down from the top plate (1). Lower in the stack lifts more plates, so a higher position is always heavier."

/** Manufacturer stack facts. Stored resistance remains a selector position, never pounds. */
export const weightStacks = {
	"cl-2403": {
		composition: "41 lb top plate + 20 × 20 lb plates",
		decals: "plate decals 1–21 from the top",
		chart: "HOIST's chart gives actual lb = 47 + 23 × (position − 1) at a 115% weight ratio.",
		sources: [page(hoistSources.cl2403, "PDF p. 40"), page(hoistSources.cl2403ManualsLib, "p. 37")]
	},
	"d-200": {
		composition: "top plate + 20 × 20 lb plates, one stack shared by the pulldown and the row",
		decals: "plate decals 1–21",
		chart:
			"Weight-chart decal 021-0003280 gives selected lb = 46 + 20 × (position − 1); ratios are 50% for the pulldown and 60% for the row (the ratio table assumes a 40 lb top plate). Installed units may lack the chart decal.",
		sources: [page(hoistSources.d200RevB, "PDF pp. 21, 25")]
	},
	"d-300": {
		composition: "top plate + 4 × 12.5 lb + 11 × 20 lb plates",
		decals: "plate decals 1–16",
		chart:
			"The later manual's chart gives selected lb 17, 30, 42, 55, 67, then +20 per position to 287; the ratio is 70%. Installed units may lack the chart decal.",
		sources: [page(hoistSources.d300RevB, "PDF pp. 18, 22")]
	},
	"d-400": {
		composition: "top plate + 15 × 20 lb plates",
		decals: "plate labels are not documented",
		chart: "HOIST lists a 350 lb stack and a 68% weight ratio.",
		sources: [hoistSources.d400, hoistSources.d400Product]
	},
	"d-600": {
		composition: "top plate + 15 × 20 lb plates",
		decals: "plate labels are not documented",
		chart: "HOIST lists a 350 lb stack and a 40% weight ratio.",
		sources: [hoistSources.d600, hoistSources.d600Product]
	}
} as const satisfies Record<MachineId, WeightStack>

export const equipmentConfirmation = {
	markings:
		"Read each control by its numbering convention. A control without an agreed convention is not recorded until the user and the theory agree how it is counted; never number unseen holes or infer a range.",
	resistance: `With the stack fully down, insert the weight-stack selector completely at the observed position. ${weightStackRule} Resistance is separate from every body-fit adjustment.`,
	retention:
		"A missing, damaged, or non-engaging retaining component is a servicing issue. Stop using that equipment until corrected; do not substitute a setting.",
	bench:
		"Name the bench actually used; its label is recorded on each set. Confirm the supported backrest angle or reproducible mark and whether the seat is fixed or adjustable; confirm the seat mark if adjustable. Support unloaded pads, engage their actual retaining hardware, and verify it before use. Never borrow a model or numbered mark from another bench's manual."
} as const
