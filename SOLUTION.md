# Solution Overview – TriageSync

TriageSync provides a centralized solution for managing support tickets and resource bookings.

### System Workflow

1. Users register and log in securely.
2. Administrators import and manage support tickets.
3. Administrators assign tickets to specific users.
4. Users can view and review only their assigned tickets.
5. Administrators create resources and configure their capacity.
6. Users request bookings for available resources.
7. Administrators approve or reject booking requests.
8. The system validates booking conflicts and prevents overlapping or concurrent booking limit violations.

### Technical Approach

- Frontend:React provides the user interface and React Router handles navigation.
- Backend: Express.js provides REST API endpoints for application operations.
-  Database:  PostgreSQL stores user, ticket, resource, and booking information.
-  Authentication:  JWT verifies users, while role-based middleware controls access.
-  Validation:  Backend checks protect ticket updates and booking operations.

### Main Objective

The main objective is to reduce manual work in ticket handling and resource allocation while maintaining secure access, organized workflows, and reliable booking management.