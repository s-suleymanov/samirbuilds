// Discourage casual dragging/saving; this is not access control.
const profilePhoto = document.querySelector('[data-profile-photo]');
if (profilePhoto) {
  profilePhoto.addEventListener('dragstart', event => event.preventDefault());
  profilePhoto.addEventListener('contextmenu', event => event.preventDefault());
}
