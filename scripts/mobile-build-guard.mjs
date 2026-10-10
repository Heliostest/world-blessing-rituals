export function verifyStoreBuild(build, expo, platform) {
  const identifier = platform === 'ios' ? expo.ios.bundleIdentifier : expo.android.package;
  if (build.app?.id !== expo.extra.eas.projectId || build.platform?.toLowerCase() !== platform ||
      build.status !== 'FINISHED' || build.appIdentifier !== identifier || build.distribution !== 'STORE') {
    throw Error('Build does not match the configured app, platform, finished state or store distribution');
  }
  return identifier;
}
