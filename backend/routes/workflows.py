from fastapi import APIRouter, BackgroundTasks
from workflows.tracker import ApplicationTracker
from workflows.job_discovery import JobDiscoveryWorkflow
from workflows.email_monitor import EmailMonitorWorkflow
from orchestrator import WorkflowOrchestrator

router = APIRouter(prefix="/workflows", tags=["Workflows"])
orchestrator = WorkflowOrchestrator()


@router.get("/stats")
def get_workflow_statistics():
    return ApplicationTracker.get_summary_statistics()


@router.post("/queue/run")
def trigger_queue_run(background_tasks: BackgroundTasks):
    background_tasks.add_task(orchestrator.run_queued_applications)
    return {"message": "Queued applications run initiated in background."}


@router.post("/discovery/run")
def trigger_discovery(background_tasks: BackgroundTasks):
    background_tasks.add_task(orchestrator.run_discovery_cycle)
    return {"message": "Job discovery initiated in background."}


@router.post("/email/run")
def trigger_email_check(background_tasks: BackgroundTasks):
    background_tasks.add_task(orchestrator.run_email_cycle)
    return {"message": "Email monitor scan initiated in background."}
