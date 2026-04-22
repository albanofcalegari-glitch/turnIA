"use strict";
// ── Enums ────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANS = exports.ExceptionType = exports.AppointmentStatus = exports.TenantRole = void 0;
var TenantRole;
(function (TenantRole) {
    TenantRole["ADMIN"] = "ADMIN";
    TenantRole["PROFESSIONAL"] = "PROFESSIONAL";
    TenantRole["CLIENT"] = "CLIENT";
})(TenantRole || (exports.TenantRole = TenantRole = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "PENDING";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
    AppointmentStatus["NO_SHOW"] = "NO_SHOW";
    AppointmentStatus["RESCHEDULED"] = "RESCHEDULED";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var ExceptionType;
(function (ExceptionType) {
    ExceptionType["BLOCK"] = "BLOCK";
    ExceptionType["VACATION"] = "VACATION";
    ExceptionType["HOLIDAY"] = "HOLIDAY";
    ExceptionType["CUSTOM_HOURS"] = "CUSTOM_HOURS";
})(ExceptionType || (exports.ExceptionType = ExceptionType = {}));
exports.PLANS = {
    standard: {
        tier: 'standard',
        label: 'Estándar',
        amount: 60000,
        currency: 'ARS',
        maxProfessionals: 1,
        reason: 'Suscripción TurnIT Estándar',
    },
    pro: {
        tier: 'pro',
        label: 'Pro',
        amount: 75000,
        currency: 'ARS',
        maxProfessionals: null,
        reason: 'Suscripción TurnIT Pro',
    },
};
