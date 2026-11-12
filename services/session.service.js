export function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function saveSession(request) {
  return new Promise((resolve, reject) => {
    request.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function startAuthenticatedSession(request, user, accountType) {
  await regenerateSession(request);
  request.session.userId = user.userId;
  request.session.authVersion = user.authVersion || 0;
  request.session.accountType = accountType;
  await saveSession(request);
}

export function destroySession(request) {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
