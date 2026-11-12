import HttpError from "../utils/httpError.js";

export function requireAdminRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.adminRole)) {
      throw new HttpError(403, "You do not have permission to perform this action.");
    }

    next();
  };
}

export const requireOwner = requireAdminRole("owner");