package com.i3hub.optima.enumeration;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * The department vocabulary used for allocation.
 *
 * Derived from the {@code deptTagMap} in the production RCM Auto-Assignment
 * workflow, which is the actual matching vocabulary in use — 28 departments with
 * 42 display-name aliases.
 *
 * <p>Deliberately NOT sourced from the {@code vendorDepartments} entity: that is a
 * per-branch administrative list (14 rows across 2 branches, including non-clinical
 * entries such as "Outpatients" and "Laboratoties") and 19 of the 24 department
 * tags actually used by production teams have no row in it. Resolving allocation
 * departments against it would silently break matching.
 *
 * <p>Aliases exist because source systems spell departments inconsistently
 * ("e. n. t.", "e.n.t.", "ent"). {@link #fromDisplayName(String)} performs the same
 * normalisation the workflow does, so v2 accepts every spelling v1 accepted.
 */
public enum RcmDepartment {

	E_N_T("department-E.N.T", "e. n. t.", "e.n.t.", "ent"),
	ICU("department-ICU", "icu", "intensive care unit", "intensive care unit - icu"),
	ANESTHESIA("department-anesthesia", "anesthesia"),
	CARDIOLOGY("department-cardiology", "cardiology", "cardiology services"),
	CLINICAL_PSYCHIATRY("department-clinical-psychiatry", "clinical psychiatry"),
	COSMETRIX("department-cosmetrix", "cosmetrix"),
	DENTAL_AND_MAXILLOFACIAL("department-dental-and-maxillofacial", "dental and maxillofacial"),
	DERMATALOGY("department-dermatalogy", "dermatalogy", "dermatology"),
	DIETICIAN_NUTRITION("department-dietician-nutrition", "dietician", "dietician / nutrition", "nutrition"),
	EMERGENCY("department-emergency", "emergency"),
	INTERNAL_MEDICINE("department-internal-medicine", "internal medicine"),
	MATERNITY("department-maternity", "maternity"),
	MEDICAL_IMAGING("department-medical-imaging", "medical imaging"),
	NEUROLOGY("department-neurology", "neurology"),
	NEUROSURGERY("department-neurosurgery", "dr. amr el shawarbi  neurosurgery center", "neurosurgery"),
	OBSTETRICS_GYNE_IVF("department-obstetrics-gyne-IVF", "obstetrics & gynae & ivf", "obstetrics & gyne & ivf"),
	ONCOLOGY("department-oncology", "gihc oncology", "hematology", "oncology",
			"oncology/ hematology", "oncology/hematology"),
	OPHTHALMOLOGY("department-ophthalmology", "ophthalmology"),
	OPTIMETRY("department-optimetry", "optics", "optimetry"),
	ORTHOPEDICS("department-orthopedics", "orthopedics"),
	PEDIATRICS_NEONATOLOGY("department-pediatrics-neonatology", "pediatrics", "pediatrics & neonatology"),
	PHYSIOTHERAPY("department-physiotherapy", "physiotherapy"),
	PODIATRY("department-podiatry", "podiatrics", "podiatry"),
	PSYCHIATRY("department-psychiatry", "psychiatry"),
	RADIOLOGY("department-radiology", "radiology"),
	RHEUMATOLOGY("department-rheumatology", "rheumatology"),
	SURGERY("department-surgery", "surgery"),
	UROLOGY("department-urology", "urology"),
	;

	private final String tag;
	private final List<String> aliases;

	RcmDepartment(String tag, String... aliases) {
		this.tag = tag;
		this.aliases = List.of(aliases);
	}

	/** The canonical tag, e.g. {@code department-cardiology}. */
	public String getTag() {
		return tag;
	}

	/** Display-name spellings that resolve to this department. */
	public List<String> getAliases() {
		return aliases;
	}

	private static final Map<String, RcmDepartment> BY_KEY;

	static {
		Map<String, RcmDepartment> index = new HashMap<>();
		for (RcmDepartment dept : values()) {
			index.put(normalize(dept.tag), dept);
			index.put(normalize(dept.name()), dept);
			for (String alias : dept.aliases) {
				index.put(normalize(alias), dept);
			}
		}
		BY_KEY = Collections.unmodifiableMap(index);
	}

	/**
	 * Strips everything but letters and digits, so "E. N. T.", "e.n.t." and "ENT"
	 * all collapse to the same key.
	 */
	private static String normalize(String value) {
		return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
	}

	/**
	 * Resolves a department by tag, enum name, or any known display-name alias.
	 *
	 * @return empty when the name is unmapped — the caller should treat that as an
	 *         uncovered department rather than guessing
	 */
	public static Optional<RcmDepartment> fromDisplayName(String name) {
		if (name == null || name.isBlank()) {
			return Optional.empty();
		}
		return Optional.ofNullable(BY_KEY.get(normalize(name)));
	}

	/** All canonical tags, for populating pickers. */
	public static List<String> allTags() {
		return Arrays.stream(values()).map(RcmDepartment::getTag).toList();
	}
}
