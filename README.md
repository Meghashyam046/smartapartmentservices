#Secure Smart Apartment Management System

## Smart Apartment Maintenance & Technician Verification Platform

Smart apartment is a full-stack housing management platform designed to streamline maintenance operations while improving resident confidence during technician visits.

The platform combines a maintenance ticket system with QR-based technician verification, allowing residents to confirm that a visiting worker is assigned to their service request before granting access.

---

## Overview

Modern residential communities frequently face maintenance issues that require technicians, contractors, or service personnel to enter private homes. Residents often have limited ways to verify whether a visitor is genuinely assigned to their complaint.

SecureSociety addresses this challenge through a digital workflow that connects residents, technicians, and administrators within a single platform.

### Core Workflow

1. Resident submits a maintenance complaint.
2. Worker accept the complaint.
3. Technician receives the task through their work portal.
4. A verification QR code is generated for the assigned technician.
5. Resident scans the QR code upon arrival.
6. The platform verifies assignment details and displays technician information.
7. Service is completed and feedback is collected.

---

# Features

## Resident Portal

### Maintenance Requests

* Submit maintenance complaints.
* Categorize issues by type and severity.
* Track complaint status in real time.
* View assigned technician information.

### QR Verification

* Scan technician verification QR codes.
* Confirm active assignment details.
* Verify service authorization before granting access.

### Safety Assistance

* Guided troubleshooting instructions.
* Emergency precaution recommendations.
* Issue-specific safety guidance.

### Ratings & Feedback

* Rate technician performance.
* Submit service feedback.
* Track maintenance history.

---

## Technician Portal

### Skill-Based Registration

Technicians can register under specialized categories such as:

* Electrician
* Plumber
* Carpenter
* HVAC Specialist
* Painter
* General Maintenance

### Task Management

* View assigned jobs.
* Track active tasks.
* Update work progress.
* Maintain service history.

### Verification QR Generation

* Generate task-linked QR codes.
* Display technician assignment details.
* Enable resident verification workflows.

---

## Administrator Dashboard

### Complaint Management

* View all maintenance requests.
* Monitor active and pending issues.
* Track completion metrics.

### Smart Dispatching

* Assign technicians based on specialization.
* Manage workforce availability.
* Route complaints efficiently.

### Audit & Activity Logs

* Maintain service records.
* Review verification activity.
* Monitor technician performance.

### User Management

* Manage residents.
* Manage technicians.
* Administrative account controls.

---

# System Architecture

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS

Backend:

* Node.js
* Express.js

Authentication:

* JWT Authentication
* Google OAuth Integration

Additional Services:

* QR Code Generation
* QR Code Scanning
* AI-Powered Safety Guidance

---

# Key Highlights

### Role-Based Access Control

Three separate user experiences:

* Resident
* Technician
* Administrator

### QR Verification Workflow

Provides an additional verification step between residents and assigned technicians.

### Backend-Centric Design

Sensitive credentials and server operations are handled through backend services rather than exposed directly in the client application.

### Cross-Platform Experience

Responsive interface optimized for:

* Desktop
* Tablet
* Mobile Devices

---

# Project Goals

* Improve maintenance request management.
* Enhance technician verification workflows.
* Provide transparent service tracking.
* Deliver a modern housing management experience.

---


## Install Dependencies

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```env
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Run Development Server

```bash
npm run dev
```

## Build Production Version

```bash
npm run build
```

---

# Future Enhancements

* Push Notifications
* Real-Time Technician Tracking
* SMS & Email Alerts
* Digital Visitor Passes
* Community Analytics Dashboard
* Multi-Society Support

---

# License

This project was developed as a portfolio and educational project demonstrating full-stack application architecture, role-based access control, QR verification workflows, and housing management operations.
