const express = require('express');
const { getDefaultIndex } = require('../services/obsidianIndex');
const { getDefaultProposalStore } = require('../services/taskProposalStore');

const router = express.Router();

router.get('/health', (req, res) => {
  const index = getDefaultIndex();
  index.ensureFresh();
  res.json({
    ...index.health(),
    projects: index.listProjects(),
  });
});

router.post('/reindex', (req, res) => {
  const index = getDefaultIndex();
  res.json({
    success: true,
    ...index.refresh(),
    projects: index.listProjects(),
  });
});

router.get('/projects', (req, res) => {
  res.json({
    success: true,
    projects: getDefaultIndex().listProjects(),
  });
});

router.get('/proposals', (req, res) => {
  const proposals = getDefaultProposalStore().list(req.query.status);
  res.json({ success: true, proposals });
});

router.post('/proposals/:id/approve', (req, res, next) => {
  try {
    const proposal = getDefaultProposalStore().approve(req.params.id, {
      task: req.body.task,
      projectId: req.body.projectId,
      due: req.body.due,
    });
    res.json({ success: true, proposal });
  } catch (error) {
    next(error);
  }
});

router.post('/proposals/:id/reject', (req, res, next) => {
  try {
    const proposal = getDefaultProposalStore().reject(req.params.id);
    res.json({ success: true, proposal });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
