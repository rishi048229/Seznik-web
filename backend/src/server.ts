import app from './app';
import { ensureAdditiveSchema } from './utils/ensureAdditiveSchema';

const PORT = process.env.PORT || 5000;

ensureAdditiveSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to ensure additive database columns:', err);
    // Still listen so login/health keep working; settings routes retry ensure on demand.
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} (schema ensure failed)`);
    });
  });
