import {
  getLaborSummary,
  getPartyMonthlyOutstandingSummary,
  getPeriodFromRequest,
  getRoznamchaSummary,
  VALID_LABOR_PERIODS,
  VALID_PARTY_PERIODS,
  VALID_ROZNAMCHA_PERIODS,
} from "../services/reportService.js";

const getRangeQuery = (req) => ({
  start: req.query.start,
  end: req.query.end,
});

export const getRoznamchaSummaryReport = async (req, res) => {
  const period = getPeriodFromRequest(
    req.query.period,
    VALID_ROZNAMCHA_PERIODS,
  );
  const report = await getRoznamchaSummary({
    period,
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getRoznamchaDailyReport = async (req, res) => {
  const report = await getRoznamchaSummary({
    period: "daily",
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getRoznamchaWeeklyReport = async (req, res) => {
  const report = await getRoznamchaSummary({
    period: "weekly",
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getRoznamchaMonthlyReport = async (req, res) => {
  const report = await getRoznamchaSummary({
    period: "monthly",
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getLaborSummaryReport = async (req, res) => {
  const period = getPeriodFromRequest(req.query.period, VALID_LABOR_PERIODS);
  const report = await getLaborSummary({
    period,
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getLaborWeeklyReport = async (req, res) => {
  const report = await getLaborSummary({
    period: "weekly",
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getLaborMonthlyReport = async (req, res) => {
  const report = await getLaborSummary({
    period: "monthly",
    ...getRangeQuery(req),
  });
  res.json(report);
};

export const getPartyMonthlyOutstandingReport = async (req, res) => {
  const period = getPeriodFromRequest(req.query.period, VALID_PARTY_PERIODS);
  const report = await getPartyMonthlyOutstandingSummary({
    period,
    ...getRangeQuery(req),
  });
  res.json(report);
};
