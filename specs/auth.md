Okay sine project can be run anyhow now we proceed with features. Auth, organizing users within projects, and rbac around it.
1. Auth
 - simple password login for now nothing fancy later possibly email invitation but i dont have sendgrid or other smtp and i dont bother testing locally now
 - simple registration for now user when registers is standard user by default 
2. Project management
 - super admin seeded for now and can do everything
 - each user can create it's own project, while doing so his privilages are elevated to admin/manager of the project itself and he can add other users 
 - prepare a structure for rbac within project like task management etc. nothing specific i dont have list of permissions but prepare a roles to point to
3. Done criteria:
- super admin is seeded
- i can register
- i can login 
- i can as standard user create a project 
- from list of available users i can add users that are not part of this projects already to my project
- i can also delete projects etc.
- roles within project structure existing

FYI. by saying project i mean project's project entity