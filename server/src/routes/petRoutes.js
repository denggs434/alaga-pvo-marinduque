const router = require('express').Router();
const c = require('../controllers/petController');
const { protect, adminOnly, ownerOnly, optionalAuth } = require('../middleware/auth');

router.route('/').get(optionalAuth, c.listPets).post(protect, ownerOnly, c.createPet);
router.get('/mine', protect, c.myPets);
router.route('/:id').get(optionalAuth, c.getPet).put(protect, c.updatePet).delete(protect, c.deletePet);
router.patch('/:id/verify', protect, adminOnly, c.verifyPet);

// Health records: the owner adds and removes entries; PVO staff only approve or reject them
router.post('/:id/vaccinations', protect, c.addVaccination);
router.patch('/:id/vaccinations/:vid/verify', protect, adminOnly, c.verifyVaccination);
router.delete('/:id/vaccinations/:vid', protect, c.removeVaccination);
router.post('/:id/medical', protect, c.addMedical);
router.delete('/:id/medical/:mid', protect, c.removeMedical);

module.exports = router;
