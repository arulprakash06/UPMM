let token = localStorage.getItem("upm_token");

let currentUser = null;

let currentPatient = null;

let selectedPatientId = null;


/* ======================================================
   API HELPER
====================================================== */

async function api(
    url,
    options = {}
) {

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(
            url,
            {
                ...options,
                headers
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            "Something went wrong."
        );
    }

    return data;
}


/* ======================================================
   INITIAL LOAD
====================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        if (token) {

            try {

                await loadCurrentUser();

                showDashboard();

            } catch {

                logout();

            }

        } else {

            showLanding();

        }
    }
);


/* ======================================================
   LANDING
====================================================== */

function showLanding() {

    document
        .getElementById("landingPage")
        .classList.remove("hidden");

    document
        .getElementById("authPage")
        .classList.add("hidden");

    document
        .getElementById("dashboardPage")
        .classList.add("hidden");
}


/* ======================================================
   AUTH
====================================================== */

let selectedRole = "patient";


function openLogin(role) {

    selectedRole = role;

    document
        .getElementById("landingPage")
        .classList.add("hidden");

    document
        .getElementById("authPage")
        .classList.remove("hidden");

    showLogin();

    const subtitle =
        document.getElementById(
            "authSubtitle"
        );

    subtitle.textContent =
        `${capitalize(role)} secure access`;
}


function showLogin() {

    document
        .getElementById("loginForm")
        .classList.remove("hidden");

    document
        .getElementById("registerForm")
        .classList.add("hidden");

    clearAuthMessage();
}


function showRegister() {

    document
        .getElementById("loginForm")
        .classList.add("hidden");

    document
        .getElementById("registerForm")
        .classList.remove("hidden");

    document
        .getElementById("registerRole")
        .value =
        selectedRole;

    clearAuthMessage();
}


function clearAuthMessage() {

    document
        .getElementById("authMessage")
        .textContent = "";
}


function showAuthMessage(message) {

    document
        .getElementById("authMessage")
        .textContent = message;
}


/* ======================================================
   LOGIN
====================================================== */

async function login() {

    const email =
        document
            .getElementById("loginEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            .value;

    if (!email || !password) {

        showAuthMessage(
            "Please enter email and password."
        );

        return;
    }

    try {

        const data =
            await api(
                "/api/auth/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

        token = data.token;

        localStorage.setItem(
            "upm_token",
            token
        );

        currentUser =
            data.user;

        showDashboard();

        await loadCurrentUser();

    } catch (error) {

        showAuthMessage(
            error.message
        );
    }
}


/* ======================================================
   REGISTER
====================================================== */

async function register() {

    const name =
        document
            .getElementById("registerName")
            .value
            .trim();

    const email =
        document
            .getElementById("registerEmail")
            .value
            .trim();

    const phone =
        document
            .getElementById("registerPhone")
            .value
            .trim();

    const password =
        document
            .getElementById("registerPassword")
            .value;

    const role =
        document
            .getElementById("registerRole")
            .value;

    const organization =
        document
            .getElementById("registerOrganization")
            .value
            .trim();


    if (
        !name ||
        !email ||
        !password
    ) {

        showAuthMessage(
            "Please complete all required fields."
        );

        return;
    }


    try {

        const data =
            await api(
                "/api/auth/register",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password,
                        role,
                        organization
                    })
                }
            );

        token =
            data.token;

        localStorage.setItem(
            "upm_token",
            token
        );

        currentUser =
            data.user;

        showDashboard();

        await loadCurrentUser();

        if (
            data.patient
        ) {

            alert(
                `Account created!\n\nYour UPM Patient ID is:\n${data.patient.patientId}`
            );
        }

    } catch (error) {

        showAuthMessage(
            error.message
        );
    }
}


/* ======================================================
   CURRENT USER
====================================================== */

async function loadCurrentUser() {

    const data =
        await api(
            "/api/auth/me"
        );

    currentUser =
        data.user;

    currentPatient =
        data.patient;

    updateHeader();

    await loadDashboard();
}


/* ======================================================
   DASHBOARD
====================================================== */

function showDashboard() {

    document
        .getElementById("landingPage")
        .classList.add("hidden");

    document
        .getElementById("authPage")
        .classList.add("hidden");

    document
        .getElementById("dashboardPage")
        .classList.remove("hidden");
}


function updateHeader() {

    document
        .getElementById("userName")
        .textContent =
        currentUser.name;

    document
        .getElementById("userRole")
        .textContent =
        capitalize(
            currentUser.role
        );

    document
        .getElementById("welcomeText")
        .textContent =
        `Welcome, ${currentUser.name}`;

    document
        .getElementById("userAvatar")
        .textContent =
        currentUser.name
            .charAt(0)
            .toUpperCase();
}


/* ======================================================
   LOAD DASHBOARD
====================================================== */

async function loadDashboard() {

    if (
        currentUser.role ===
        "patient"
    ) {

        await loadPatientDashboard();

    } else {

        loadProfessionalDashboard();

    }
}


/* ======================================================
   PATIENT DASHBOARD
====================================================== */

async function loadPatientDashboard() {

    const data =
        await api(
            "/api/patients/me"
        );

    currentPatient =
        data;

    renderPatientStats();

    renderPatientOverview();

    renderPatientHistory();

    renderPatientMedications();

    renderEmergency();
}


/* ======================================================
   PATIENT STATS
====================================================== */

function renderPatientStats() {

    const medications =
        currentPatient.medications ||
        [];

    const records =
        currentPatient.medicalRecords ||
        [];

    const allergies =
        currentPatient.allergies ||
        [];

    document
        .getElementById("statsGrid")
        .innerHTML = `

        <div class="stat-card">

            <div class="stat-icon">
                🆔
            </div>

            <div class="stat-label">
                UPM Patient ID
            </div>

            <div class="stat-value">
                ${escapeHtml(
                    currentPatient.patientId
                )}
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                📋
            </div>

            <div class="stat-label">
                Medical Records
            </div>

            <div class="stat-value">
                ${records.length}
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                💊
            </div>

            <div class="stat-label">
                Active Medications
            </div>

            <div class="stat-value">
                ${medications.filter(
                    item =>
                        item.status !== "Stopped"
                ).length}
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                ⚠️
            </div>

            <div class="stat-label">
                Recorded Allergies
            </div>

            <div class="stat-value">
                ${allergies.length}
            </div>

        </div>
    `;
}


/* ======================================================
   PATIENT OVERVIEW
====================================================== */

function renderPatientOverview() {

    const conditions =
        currentPatient.conditions ||
        [];

    const allergies =
        currentPatient.allergies ||
        [];

    document
        .getElementById("overviewContent")
        .innerHTML = `

        <div class="section-card">

            <p class="eyebrow">
                PATIENT PROFILE
            </p>

            <div class="patient-profile">

                <div class="patient-photo">
                    👤
                </div>

                <div>

                    <div class="patient-name">
                        ${escapeHtml(
                            currentUser.name
                        )}
                    </div>

                    <div class="patient-id">
                        ${escapeHtml(
                            currentPatient.patientId
                        )}
                    </div>

                </div>

            </div>


            <div class="info-grid">

                <div class="info-box">

                    <label>
                        Age
                    </label>

                    <strong>
                        ${currentPatient.age || "Not provided"}
                    </strong>

                </div>


                <div class="info-box">

                    <label>
                        Gender
                    </label>

                    <strong>
                        ${escapeHtml(
                            currentPatient.gender ||
                            "Not provided"
                        )}
                    </strong>

                </div>


                <div class="info-box">

                    <label>
                        Blood Group
                    </label>

                    <strong>
                        ${escapeHtml(
                            currentPatient.bloodGroup ||
                            "Not provided"
                        )}
                    </strong>

                </div>


                <div class="info-box">

                    <label>
                        Allergies
                    </label>

                    <strong>
                        ${
                            allergies.length
                                ? escapeHtml(
                                    allergies.join(", ")
                                )
                                : "None recorded"
                        }
                    </strong>

                </div>

            </div>


            <div class="info-grid">

                <div class="info-box">

                    <label>
                        Conditions
                    </label>

                    <strong>
                        ${
                            conditions.length
                                ? escapeHtml(
                                    conditions.join(", ")
                                )
                                : "None recorded"
                        }
                    </strong>

                </div>


                <div class="info-box">

                    <label>
                        Family History
                    </label>

                    <strong>
                        ${
                            currentPatient.familyHistory &&
                            currentPatient.familyHistory.length
                                ? escapeHtml(
                                    currentPatient.familyHistory.join(", ")
                                )
                                : "None recorded"
                        }
                    </strong>

                </div>

            </div>

        </div>


        <div>

            <div class="section-card">

                <p class="eyebrow">
                    SAFETY
                </p>

                <h2>
                    Patient Safety Profile
                </h2>

                ${
                    allergies.length
                        ? `
                            <div class="warning-box">
                                ⚠️
                                Allergy information is recorded.
                                Always review before prescribing.
                            </div>
                        `
                        : `
                            <div class="safe-box">
                                ✓
                                No allergies currently recorded.
                            </div>
                        `
                }

            </div>


            <div class="section-card">

                <p class="eyebrow">
                    IDENTITY
                </p>

                <h2>
                    UPM Patient ID
                </h2>

                <p>
                    ${escapeHtml(
                        currentPatient.patientId
                    )}
                </p>

                <br>

                <button
                    class="primary-button"
                    onclick="showDashboardTab('qr')"
                >
                    View My QR
                </button>

            </div>

        </div>
    `;
}


/* ======================================================
   HISTORY
====================================================== */

function renderPatientHistory() {

    const records =
        currentPatient.medicalRecords ||
        [];

    const container =
        document.getElementById(
            "historyContent"
        );

    if (!records.length) {

        container.innerHTML = `
            <div class="safe-box">
                No medical history has been added yet.
            </div>
        `;

        return;
    }

    container.innerHTML = `

        <div class="timeline">

            ${records
                .slice()
                .reverse()
                .map(record => `

                    <div class="timeline-item">

                        <h3>
                            ${escapeHtml(
                                record.title ||
                                "Medical Record"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                record.type ||
                                "Consultation"
                            )}
                            •
                            ${escapeHtml(
                                record.date || ""
                            )}
                        </p>

                        <p>
                            ${escapeHtml(
                                record.description ||
                                ""
                            )}
                        </p>

                        ${
                            record.doctor
                                ? `
                                    <p>
                                        Doctor:
                                        ${escapeHtml(
                                            record.doctor
                                        )}
                                    </p>
                                `
                                : ""
                        }

                    </div>

                `)
                .join("")}

        </div>
    `;
}


/* ======================================================
   MEDICATIONS
====================================================== */

function renderPatientMedications() {

    const medications =
        currentPatient.medications ||
        [];

    const container =
        document.getElementById(
            "medicationsContent"
        );

    if (!medications.length) {

        container.innerHTML = `
            <div class="safe-box">
                No medications recorded.
            </div>
        `;

        return;
    }

    container.innerHTML =
        medications
            .map(medication => `

                <div class="list-item">

                    <div>

                        <strong>
                            ${escapeHtml(
                                medication.name
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                medication.dosage ||
                                ""
                            )}
                            •
                            ${escapeHtml(
                                medication.frequency ||
                                ""
                            )}
                        </small>

                    </div>

                    <span class="badge badge-green">
                        ${escapeHtml(
                            medication.status ||
                            "Active"
                        )}
                    </span>

                </div>

            `)
            .join("");
}


/* ======================================================
   EMERGENCY
====================================================== */

function renderEmergency() {

    const contact =
        currentPatient.emergencyContact ||
        {};

    document
        .getElementById("emergencyContent")
        .innerHTML = `

        <div class="emergency-grid">

            <div class="emergency-box">

                <label>
                    Patient
                </label>

                <strong>
                    ${escapeHtml(
                        currentUser.name
                    )}
                </strong>

            </div>


            <div class="emergency-box">

                <label>
                    Blood Group
                </label>

                <strong>
                    ${escapeHtml(
                        currentPatient.bloodGroup ||
                        "Not recorded"
                    )}
                </strong>

            </div>


            <div class="emergency-box">

                <label>
                    Allergies
                </label>

                <strong>
                    ${
                        currentPatient.allergies &&
                        currentPatient.allergies.length
                            ? escapeHtml(
                                currentPatient.allergies.join(", ")
                            )
                            : "None recorded"
                    }
                </strong>

            </div>


            <div class="emergency-box">

                <label>
                    Conditions
                </label>

                <strong>
                    ${
                        currentPatient.conditions &&
                        currentPatient.conditions.length
                            ? escapeHtml(
                                currentPatient.conditions.join(", ")
                            )
                            : "None recorded"
                    }
                </strong>

            </div>


            <div class="emergency-box">

                <label>
                    Emergency Contact
                </label>

                <strong>
                    ${escapeHtml(
                        contact.name ||
                        "Not recorded"
                    )}
                </strong>

                <small>
                    ${escapeHtml(
                        contact.phone ||
                        ""
                    )}
                </small>

            </div>

        </div>
    `;
}


/* ======================================================
   PROFESSIONAL DASHBOARD
====================================================== */

function loadProfessionalDashboard() {

    document
        .getElementById("statsGrid")
        .innerHTML = `

        <div class="stat-card">

            <div class="stat-icon">
                🩺
            </div>

            <div class="stat-label">
                Account Type
            </div>

            <div class="stat-value">
                ${capitalize(
                    currentUser.role
                )}
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                🔎
            </div>

            <div class="stat-label">
                Patient Search
            </div>

            <div class="stat-value">
                Ready
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                💊
            </div>

            <div class="stat-label">
                Safety Check
            </div>

            <div class="stat-value">
                Active
            </div>

        </div>


        <div class="stat-card">

            <div class="stat-icon">
                🔐
            </div>

            <div class="stat-label">
                Access Logging
            </div>

            <div class="stat-value">
                Enabled
            </div>

        </div>
    `;


    document
        .getElementById("overviewContent")
        .innerHTML = `

        <div class="section-card">

            <p class="eyebrow">
                CLINICAL ACCESS
            </p>

            <h2>
                Search a UPM Patient
            </h2>

            <p>
                Use the patient's UPM ID to
                retrieve their available
                medical information.
            </p>

            <br>

            <button
                class="primary-button"
                onclick="showDashboardTab('search')"
            >
                Search Patient
            </button>

        </div>


        <div class="section-card">

            <p class="eyebrow">
                SAFETY
            </p>

            <h2>
                Prescription Safety
            </h2>

            <p>
                Review allergies, existing
                medications and prototype
                interaction warnings before
                saving a prescription.
            </p>

        </div>
    `;
}


/* ======================================================
   QR
====================================================== */

async function loadQR() {

    const container =
        document.getElementById(
            "qrContainer"
        );

    container.innerHTML =
        "Generating QR...";

    try {

        const data =
            await api(
                "/api/patients/me/qr"
            );

        container.innerHTML = `

            <img
                class="qr-image"
                src="${data.qrImage}"
                alt="UPM Patient QR"
            >

            <div class="qr-id">
                ${escapeHtml(
                    data.patientId
                )}
            </div>

            <small>
                Scan using an authorized UPM account.
            </small>
        `;

    } catch (error) {

        container.innerHTML = `
            <div class="warning-box">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


/* ======================================================
   ACCESS LOGS
====================================================== */

async function loadAccessLogs() {

    const container =
        document.getElementById(
            "accessContent"
        );

    container.innerHTML =
        "Loading access history...";

    try {

        const logs =
            await api(
                "/api/access-logs/me"
            );

        if (!logs.length) {

            container.innerHTML = `
                <div class="safe-box">
                    No access records yet.
                </div>
            `;

            return;
        }

        container.innerHTML =
            logs.map(log => `

                <div class="list-item">

                    <div>

                        <strong>
                            ${escapeHtml(
                                log.action
                            )}
                        </strong>

                        <small>
                            ${
                                log.accessedBy
                                    ? escapeHtml(
                                        log.accessedBy.name
                                    )
                                    : "Unknown user"
                            }

                            •

                            ${new Date(
                                log.createdAt
                            ).toLocaleString()}
                        </small>

                    </div>

                    <span
                        class="
                            badge
                            ${
                                log.approved
                                    ? "badge-green"
                                    : "badge-yellow"
                            }
                        "
                    >
                        ${
                            log.approved
                                ? "Approved"
                                : "Logged"
                        }
                    </span>

                </div>

            `).join("");

    } catch (error) {

        container.innerHTML = `
            <div class="warning-box">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


/* ======================================================
   SEARCH PATIENT
====================================================== */

async function searchPatient() {

    const patientId =
        document
            .getElementById(
                "patientSearchInput"
            )
            .value
            .trim();

    const result =
        document.getElementById(
            "searchResult"
        );

    if (!patientId) {

        result.innerHTML = `
            <div class="warning-box">
                Enter a UPM Patient ID.
            </div>
        `;

        return;
    }

    result.innerHTML =
        "Searching...";

    try {

        const data =
            await api(
                `/api/patients/search/${encodeURIComponent(
                    patientId
                )}`
            );

        selectedPatientId =
            data.patient.patientId;

        const patient =
            data.patient;

        result.innerHTML = `

            <div class="section-card">

                <div class="patient-profile">

                    <div class="patient-photo">
                        👤
                    </div>

                    <div>

                        <div class="patient-name">
                            ${escapeHtml(
                                patient.userId.name
                            )}
                        </div>

                        <div class="patient-id">
                            ${escapeHtml(
                                patient.patientId
                            )}
                        </div>

                    </div>

                </div>


                <div class="info-grid">

                    <div class="info-box">

                        <label>
                            Age
                        </label>

                        <strong>
                            ${
                                patient.age ||
                                "Not provided"
                            }
                        </strong>

                    </div>


                    <div class="info-box">

                        <label>
                            Blood Group
                        </label>

                        <strong>
                            ${escapeHtml(
                                patient.bloodGroup ||
                                "Not recorded"
                            )}
                        </strong>

                    </div>


                    <div class="info-box">

                        <label>
                            Allergies
                        </label>

                        <strong>
                            ${
                                patient.allergies &&
                                patient.allergies.length
                                    ? escapeHtml(
                                        patient.allergies.join(", ")
                                    )
                                    : "None recorded"
                            }
                        </strong>

                    </div>


                    <div class="info-box">

                        <label>
                            Conditions
                        </label>

                        <strong>
                            ${
                                patient.conditions &&
                                patient.conditions.length
                                    ? escapeHtml(
                                        patient.conditions.join(", ")
                                    )
                                    : "None recorded"
                            }
                        </strong>

                    </div>

                </div>


                <h3 style="margin-top:25px;">
                    Current Medications
                </h3>

                ${
                    patient.medications &&
                    patient.medications.length
                        ? patient.medications
                            .map(
                                medication => `
                                    <div class="list-item">

                                        <div>

                                            <strong>
                                                ${escapeHtml(
                                                    medication.name
                                                )}
                                            </strong>

                                            <small>
                                                ${escapeHtml(
                                                    medication.dosage ||
                                                    ""
                                                )}
                                                •
                                                ${escapeHtml(
                                                    medication.frequency ||
                                                    ""
                                                )}
                                            </small>

                                        </div>

                                        <span class="badge badge-green">
                                            ${escapeHtml(
                                                medication.status ||
                                                "Active"
                                            )}
                                        </span>

                                    </div>
                                `
                            )
                            .join("")
                        : `
                            <p>
                                No medications recorded.
                            </p>
                        `
                }

            </div>
        `;


        document
            .getElementById(
                "prescriptionPanel"
            )
            .classList.remove("hidden");


    } catch (error) {

        result.innerHTML = `
            <div class="warning-box">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


/* ======================================================
   PRESCRIPTION CHECK
====================================================== */

async function checkPrescription() {

    if (!selectedPatientId) {

        showPrescriptionResult(
            ["Search for a patient first."],
            false
        );

        return;
    }

    const medicine =
        document
            .getElementById(
                "prescriptionMedicine"
            )
            .value
            .trim();

    if (!medicine) {

        showPrescriptionResult(
            ["Enter a medicine name."],
            false
        );

        return;
    }

    try {

        const data =
            await api(
                "/api/prescriptions/check",
                {
                    method: "POST",

                    body: JSON.stringify({
                        patientId:
                            selectedPatientId,

                        medicine
                    })
                }
            );

        showPrescriptionResult(
            data.warnings,
            data.safe
        );

    } catch (error) {

        showPrescriptionResult(
            [error.message],
            false
        );
    }
}


/* ======================================================
   CREATE PRESCRIPTION
====================================================== */

async function createPrescription() {

    if (!selectedPatientId) {

        showPrescriptionResult(
            ["Search for a patient first."],
            false
        );

        return;
    }

    const medicine =
        document
            .getElementById(
                "prescriptionMedicine"
            )
            .value
            .trim();

    const dosage =
        document
            .getElementById(
                "prescriptionDosage"
            )
            .value
            .trim();

    const frequency =
        document
            .getElementById(
                "prescriptionFrequency"
            )
            .value
            .trim();

    const duration =
        document
            .getElementById(
                "prescriptionDuration"
            )
            .value
            .trim();

    const reason =
        document
            .getElementById(
                "prescriptionReason"
            )
            .value
            .trim();


    if (!medicine) {

        showPrescriptionResult(
            ["Medicine name is required."],
            false
        );

        return;
    }


    try {

        const data =
            await api(
                "/api/prescriptions",
                {
                    method: "POST",

                    body: JSON.stringify({

                        patientId:
                            selectedPatientId,

                        medicine,

                        dosage,

                        frequency,

                        duration,

                        reason
                    })
                }
            );

        if (
            data.warnings &&
            data.warnings.length
        ) {

            showPrescriptionResult(
                data.warnings,
                false
            );

            alert(
                "Prescription saved with safety warnings. Clinical review is required."
            );

        } else {

            showPrescriptionResult(
                [],
                true
            );

            alert(
                "Prescription saved successfully."
            );
        }

    } catch (error) {

        showPrescriptionResult(
            [error.message],
            false
        );
    }
}


/* ======================================================
   PRESCRIPTION RESULT
====================================================== */

function showPrescriptionResult(
    warnings,
    safe
) {

    const container =
        document.getElementById(
            "prescriptionResult"
        );

    if (safe) {

        container.innerHTML = `
            <div class="safe-box">
                ✓ No prototype-level conflict
                detected from the configured rules.
                Clinical review is still required.
            </div>
        `;

        return;
    }

    if (!warnings.length) {

        container.innerHTML = "";

        return;
    }

    container.innerHTML =
        warnings
            .map(
                warning => `
                    <div class="warning-box">
                        ⚠️
                        ${escapeHtml(
                            warning
                        )}
                    </div>
                `
            )
            .join("");
}


/* ======================================================
   TABS
====================================================== */

function showDashboardTab(
    tab
) {

    const tabs = [
        "overview",
        "history",
        "medications",
        "qr",
        "access",
        "emergency",
        "search"
    ];

    tabs.forEach(
        current => {

            const element =
                document.getElementById(
                    `${current}Tab`
                );

            if (element) {

                element.classList.toggle(
                    "hidden",
                    current !== tab
                );
            }
        }
    );


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            button => {
                button.classList.remove(
                    "active"
                );
            }
        );


    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );

    const index =
        tabs.indexOf(tab);

    if (
        index >= 0 &&
        buttons[index]
    ) {

        buttons[index]
            .classList.add("active");
    }


    if (
        tab === "qr" &&
        currentUser &&
        currentUser.role === "patient"
    ) {

        loadQR();
    }


    if (
        tab === "access" &&
        currentUser &&
        currentUser.role === "patient"
    ) {

        loadAccessLogs();
    }
}


/* ======================================================
   LOGOUT
====================================================== */

function logout() {

    token = null;

    currentUser = null;

    currentPatient = null;

    localStorage.removeItem(
        "upm_token"
    );

    showLanding();
}


/* ======================================================
   UTILITY
====================================================== */

function capitalize(value) {

    if (!value) {
        return "";
    }

    return value
        .charAt(0)
        .toUpperCase() +
        value.slice(1);
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}