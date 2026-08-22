require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
    console.warn("WARNING: MONGODB_URI is not configured.");
}

if (!JWT_SECRET) {
    console.warn("WARNING: JWT_SECRET is not configured.");
}

/* -------------------------------------------------------
   SECURITY / MIDDLEWARE
------------------------------------------------------- */

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(cors());

app.use(express.json({ limit: "2mb" }));

app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        message: "Too many requests. Please try again later."
    }
});

app.use("/api/auth", authLimiter);

app.use(express.static(path.join(__dirname, "public")));


/* -------------------------------------------------------
   DATABASE SCHEMAS
------------------------------------------------------- */

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        passwordHash: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["patient", "doctor", "hospital"],
            required: true
        },

        phone: {
            type: String,
            default: ""
        },

        organization: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

const patientSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        patientId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        dateOfBirth: {
            type: String,
            default: ""
        },

        age: {
            type: Number,
            default: null
        },

        gender: {
            type: String,
            default: ""
        },

        bloodGroup: {
            type: String,
            default: ""
        },

        photo: {
            type: String,
            default: ""
        },

        allergies: [
            {
                type: String
            }
        ],

        conditions: [
            {
                type: String
            }
        ],

        familyHistory: [
            {
                type: String
            }
        ],

        emergencyContact: {
            name: {
                type: String,
                default: ""
            },

            phone: {
                type: String,
                default: ""
            },

            relationship: {
                type: String,
                default: ""
            }
        },

        medications: [
            {
                name: String,
                dosage: String,
                frequency: String,
                status: {
                    type: String,
                    default: "Active"
                },
                startedAt: String
            }
        ],

        medicalRecords: [
            {
                type: {
                    type: String,
                    default: "Consultation"
                },

                title: String,
                description: String,
                date: String,
                doctor: String
            }
        ],

        qrToken: {
            type: String,
            unique: true,
            sparse: true
        }
    },
    {
        timestamps: true
    }
);

const prescriptionSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true
        },

        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        medicine: {
            type: String,
            required: true
        },

        dosage: {
            type: String,
            default: ""
        },

        frequency: {
            type: String,
            default: ""
        },

        duration: {
            type: String,
            default: ""
        },

        reason: {
            type: String,
            default: ""
        },

        warnings: [
            {
                type: String
            }
        ],

        status: {
            type: String,
            default: "Active"
        }
    },
    {
        timestamps: true
    }
);

const accessLogSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true
        },

        accessedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        action: {
            type: String,
            required: true
        },

        approved: {
            type: Boolean,
            default: false
        },

        expiresAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);
const Patient = mongoose.model("Patient", patientSchema);
const Prescription = mongoose.model(
    "Prescription",
    prescriptionSchema
);
const AccessLog = mongoose.model(
    "AccessLog",
    accessLogSchema
);


/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function generatePatientId() {
    const random = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

    return `UPM-PAT-${random}`;
}

function generateQRToken() {
    return (
        Math.random().toString(36).substring(2) +
        Date.now().toString(36)
    );
}

function createToken(user) {
    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

function auth(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        const token = header.split(" ")[1];

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired authentication token."
        });
    }
}

function roleRequired(...roles) {
    return (req, res, next) => {

        if (!req.user || !roles.includes(req.user.role)) {

            return res.status(403).json({
                message: "You do not have permission for this action."
            });
        }

        next();
    };
}


/* -------------------------------------------------------
   PRESCRIPTION SAFETY PROTOTYPE
------------------------------------------------------- */

function checkPrescriptionSafety(
    patient,
    medicine
) {

    const warnings = [];

    const normalizedMedicine =
        medicine.toLowerCase().trim();

    const allergies =
        patient.allergies.map(
            item => item.toLowerCase()
        );

    const conditions =
        patient.conditions.map(
            item => item.toLowerCase()
        );

    const medications =
        patient.medications.map(
            item => item.name.toLowerCase()
        );


    /* Allergy */

    for (const allergy of allergies) {

        if (
            normalizedMedicine.includes(allergy) ||
            allergy.includes(normalizedMedicine)
        ) {

            warnings.push(
                `Possible allergy conflict: patient has a recorded allergy to ${allergy}.`
            );
        }
    }


    /* Duplicate medication */

    for (const medication of medications) {

        if (
            medication === normalizedMedicine ||
            medication.includes(normalizedMedicine) ||
            normalizedMedicine.includes(medication)
        ) {

            warnings.push(
                `Possible duplicate medication: ${medication} is already recorded as an active medication.`
            );
        }
    }


    /* Example prototype rules */

    if (
        normalizedMedicine.includes("ibuprofen") &&
        conditions.some(
            condition =>
                condition.includes("kidney") ||
                condition.includes("renal")
        )
    ) {

        warnings.push(
            "Prototype warning: review this medication carefully in patients with kidney-related conditions."
        );
    }


    if (
        normalizedMedicine.includes("warfarin") &&
        medications.some(
            medication =>
                medication.includes("aspirin")
        )
    ) {

        warnings.push(
            "Prototype warning: aspirin and warfarin may require clinical review."
        );
    }


    return warnings;
}


/* -------------------------------------------------------
   AUTH - REGISTER
------------------------------------------------------- */

app.post("/api/auth/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            role,
            phone,
            organization
        } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            !role
        ) {

            return res.status(400).json({
                message:
                    "Name, email, password and role are required."
            });
        }

        if (
            !["patient", "doctor", "hospital"]
                .includes(role)
        ) {

            return res.status(400).json({
                message: "Invalid role."
            });
        }

        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Password must contain at least 6 characters."
            });
        }

        const existingUser =
            await User.findOne({
                email: email.toLowerCase()
            });

        if (existingUser) {

            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const user = await User.create({
            name,
            email,
            passwordHash,
            role,
            phone: phone || "",
            organization: organization || ""
        });

        let patient = null;

        if (role === "patient") {

            patient = await Patient.create({
                userId: user._id,
                patientId: generatePatientId(),
                qrToken: generateQRToken(),
                allergies: [],
                conditions: [],
                familyHistory: [],
                medications: [],
                medicalRecords: []
            });
        }

        const token = createToken(user);

        res.status(201).json({

            message: "Account created successfully.",

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },

            patient: patient
                ? {
                    patientId: patient.patientId
                }
                : null
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Registration failed."
        });
    }
});


/* -------------------------------------------------------
   AUTH - LOGIN
------------------------------------------------------- */

app.post("/api/auth/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        const user =
            await User.findOne({
                email: email.toLowerCase()
            });

        if (!user) {

            return res.status(401).json({
                message:
                    "Invalid email or password."
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                user.passwordHash
            );

        if (!valid) {

            return res.status(401).json({
                message:
                    "Invalid email or password."
            });
        }

        const token =
            createToken(user);

        let patient = null;

        if (user.role === "patient") {

            patient =
                await Patient.findOne({
                    userId: user._id
                });
        }

        res.json({

            message: "Login successful.",

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },

            patient: patient
                ? {
                    patientId: patient.patientId
                }
                : null
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Login failed."
        });
    }
});


/* -------------------------------------------------------
   CURRENT USER
------------------------------------------------------- */

app.get(
    "/api/auth/me",
    auth,
    async (req, res) => {

        try {

            const user =
                await User.findById(
                    req.user.id
                ).select("-passwordHash");

            if (!user) {

                return res.status(404).json({
                    message: "User not found."
                });
            }

            let patient = null;

            if (user.role === "patient") {

                patient =
                    await Patient.findOne({
                        userId: user._id
                    });
            }

            res.json({
                user,
                patient
            });

        } catch (error) {

            res.status(500).json({
                message: "Unable to load profile."
            });
        }
    }
);


/* -------------------------------------------------------
   PATIENT PROFILE
------------------------------------------------------- */

app.get(
    "/api/patients/me",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    userId: req.user.id
                });

            if (!patient) {

                return res.status(404).json({
                    message: "Patient profile not found."
                });
            }

            res.json(patient);

        } catch (error) {

            res.status(500).json({
                message: "Unable to load patient."
            });
        }
    }
);


/* -------------------------------------------------------
   UPDATE PATIENT PROFILE
------------------------------------------------------- */

app.put(
    "/api/patients/me",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const allowed = [
                "dateOfBirth",
                "age",
                "gender",
                "bloodGroup",
                "photo",
                "allergies",
                "conditions",
                "familyHistory",
                "emergencyContact",
                "medications"
            ];

            const updates = {};

            for (const key of allowed) {

                if (
                    req.body[key] !== undefined
                ) {

                    updates[key] =
                        req.body[key];
                }
            }

            const patient =
                await Patient.findOneAndUpdate(
                    {
                        userId: req.user.id
                    },
                    updates,
                    {
                        new: true
                    }
                );

            res.json({
                message:
                    "Patient profile updated.",
                patient
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to update patient profile."
            });
        }
    }
);


/* -------------------------------------------------------
   SEARCH PATIENT
------------------------------------------------------- */

app.get(
    "/api/patients/search/:patientId",
    auth,
    roleRequired("doctor", "hospital"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    patientId:
                        req.params.patientId
                }).populate(
                    "userId",
                    "name email phone"
                );

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            const log =
                await AccessLog.create({
                    patientId:
                        patient._id,
                    accessedBy:
                        req.user.id,
                    action:
                        "Patient search",
                    approved: false
                });

            res.json({
                patient,
                accessLogId: log._id
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Patient search failed."
            });
        }
    }
);


/* -------------------------------------------------------
   PATIENT MEDICAL HISTORY
------------------------------------------------------- */

app.post(
    "/api/patients/me/records",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const {
                type,
                title,
                description,
                date,
                doctor
            } = req.body;

            const patient =
                await Patient.findOne({
                    userId: req.user.id
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            patient.medicalRecords.push({
                type:
                    type || "Consultation",

                title:
                    title || "Medical Record",

                description:
                    description || "",

                date:
                    date ||
                    new Date()
                        .toISOString()
                        .slice(0, 10),

                doctor:
                    doctor || ""
            });

            await patient.save();

            res.json({
                message:
                    "Medical record added.",
                patient
            });

        } catch (error) {

            res.status(500).json({
                message:
                    "Unable to add medical record."
            });
        }
    }
);


/* -------------------------------------------------------
   QR CODE
------------------------------------------------------- */

app.get(
    "/api/patients/me/qr",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    userId: req.user.id
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient profile not found."
                });
            }

            const baseUrl =
                `${req.protocol}://${req.get("host")}`;

            const qrData =
                `${baseUrl}/qr/${patient.qrToken}`;

            const qrImage =
                await QRCode.toDataURL(qrData);

            res.json({
                patientId:
                    patient.patientId,

                qrData,

                qrImage
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to generate QR."
            });
        }
    }
);


/* -------------------------------------------------------
   QR LOOKUP
------------------------------------------------------- */

app.get(
    "/api/qr/:token",
    auth,
    roleRequired("doctor", "hospital"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    qrToken:
                        req.params.token
                }).populate(
                    "userId",
                    "name email phone"
                );

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Invalid patient QR."
                });
            }

            await AccessLog.create({
                patientId:
                    patient._id,

                accessedBy:
                    req.user.id,

                action:
                    "QR scanned",

                approved: false
            });

            res.json({
                patient
            });

        } catch (error) {

            res.status(500).json({
                message:
                    "QR lookup failed."
            });
        }
    }
);


/* -------------------------------------------------------
   PRESCRIPTION SAFETY CHECK
------------------------------------------------------- */

app.post(
    "/api/prescriptions/check",
    auth,
    roleRequired("doctor", "hospital"),
    async (req, res) => {

        try {

            const {
                patientId,
                medicine
            } = req.body;

            if (!patientId || !medicine) {

                return res.status(400).json({
                    message:
                        "Patient ID and medicine are required."
                });
            }

            const patient =
                await Patient.findOne({
                    patientId
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            const warnings =
                checkPrescriptionSafety(
                    patient,
                    medicine
                );

            res.json({
                safe:
                    warnings.length === 0,

                warnings
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Safety check failed."
            });
        }
    }
);


/* -------------------------------------------------------
   CREATE PRESCRIPTION
------------------------------------------------------- */

app.post(
    "/api/prescriptions",
    auth,
    roleRequired("doctor", "hospital"),
    async (req, res) => {

        try {

            const {
                patientId,
                medicine,
                dosage,
                frequency,
                duration,
                reason
            } = req.body;

            const patient =
                await Patient.findOne({
                    patientId
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            const warnings =
                checkPrescriptionSafety(
                    patient,
                    medicine
                );

            const prescription =
                await Prescription.create({

                    patientId:
                        patient._id,

                    doctorId:
                        req.user.id,

                    medicine,

                    dosage:
                        dosage || "",

                    frequency:
                        frequency || "",

                    duration:
                        duration || "",

                    reason:
                        reason || "",

                    warnings
                });

            await AccessLog.create({
                patientId:
                    patient._id,

                accessedBy:
                    req.user.id,

                action:
                    "Prescription created",

                approved: true
            });

            res.status(201).json({
                message:
                    "Prescription created.",
                prescription,
                warnings
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to create prescription."
            });
        }
    }
);


/* -------------------------------------------------------
   PATIENT PRESCRIPTIONS
------------------------------------------------------- */

app.get(
    "/api/prescriptions/me",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    userId:
                        req.user.id
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            const prescriptions =
                await Prescription.find({
                    patientId:
                        patient._id
                })
                    .populate(
                        "doctorId",
                        "name organization"
                    )
                    .sort({
                        createdAt: -1
                    });

            res.json(
                prescriptions
            );

        } catch (error) {

            res.status(500).json({
                message:
                    "Unable to load prescriptions."
            });
        }
    }
);


/* -------------------------------------------------------
   ACCESS LOGS
------------------------------------------------------- */

app.get(
    "/api/access-logs/me",
    auth,
    roleRequired("patient"),
    async (req, res) => {

        try {

            const patient =
                await Patient.findOne({
                    userId:
                        req.user.id
                });

            if (!patient) {

                return res.status(404).json({
                    message:
                        "Patient not found."
                });
            }

            const logs =
                await AccessLog.find({
                    patientId:
                        patient._id
                })
                    .populate(
                        "accessedBy",
                        "name role organization"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(50);

            res.json(logs);

        } catch (error) {

            res.status(500).json({
                message:
                    "Unable to load access logs."
            });
        }
    }
);


/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */

app.get(
    "/api/status",
    (req, res) => {

        res.json({
            app: "UPM",
            name:
                "Universal Patient Monitoring",
            status: "online",
            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",
            time:
                new Date().toISOString()
        });
    }
);


/* -------------------------------------------------------
   FRONTEND FALLBACK
------------------------------------------------------- */

app.get(
    "*splat",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


/* -------------------------------------------------------
   DATABASE + SERVER
------------------------------------------------------- */

async function startServer() {

    try {

        if (MONGODB_URI) {

            await mongoose.connect(
                MONGODB_URI
            );

            console.log(
                "MongoDB connected successfully."
            );

        } else {

            console.log(
                "MongoDB not configured. Server will run without database."
            );
        }

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `UPM running on port ${PORT}`
                );
            }
        );

    } catch (error) {

        console.error(
            "Server startup error:",
            error
        );

        process.exit(1);
    }
}

startServer();