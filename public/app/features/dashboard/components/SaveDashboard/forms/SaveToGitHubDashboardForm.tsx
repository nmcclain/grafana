import { css } from '@emotion/css';
import { useState } from 'react';

import { FeatureState } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Modal, FeatureBadge, Field, Input, LinkButton } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { SaveDashboardFormProps } from '../types';

export const SaveToGitHubDashboardForm = ({
  dashboard,
  onCancel,
  onSuccess,
}: Omit<SaveDashboardFormProps, 'isLoading'>) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [prOpened, setPrOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardJSON] = useState(() => {
    const clone = dashboard.getSaveModelClone();
    delete clone.id;
    return JSON.stringify(clone, null, 2);
  });
  const [prDetails, setPrDetails] = useState<{ title: string; prUrl: string; pr: number } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');

  // lookup dashboard-specific Git information stored in specially-named dashboard links (this is just to make for an easy proof-of-concpet)
  const SOURCE_REPO_LINK_NAME = 'GitOps Source Repository';
  const SOURCE_BRANCH_LINK_NAME = 'GitOps Source Branch';
  const DEST_BRANCH_PREFIX_LINK_NAME = 'GitOps Destination Branch Prefix';
  const FILEPATH_LINK_NAME = 'GitOps Dashboard Filepath';
  let sourceRepo = null;
  let sourceBranch = null;
  let destBranchPrefix = null;
  let dashFilepath = null;

  for (let i = 0; i < dashboard.links.length; i++) {
    const link = dashboard.links[i];
    if (link.title === SOURCE_REPO_LINK_NAME) {
      sourceRepo = link.url;
    } else if (link.title === SOURCE_BRANCH_LINK_NAME) {
      sourceBranch = link.url;
    } else if (link.title === DEST_BRANCH_PREFIX_LINK_NAME) {
      destBranchPrefix = link.url;
    } else if (link.title === FILEPATH_LINK_NAME) {
      dashFilepath = link.url;
    }
  }

  const closeModal = () => {
    setIsModalOpen(false);
    onCancel();
  };

  const onCreatePR = async () => {
    if (!sourceRepo || !sourceBranch || !destBranchPrefix || !dashFilepath) {
      const missingLink = !sourceRepo
        ? SOURCE_REPO_LINK_NAME
        : !sourceBranch
          ? SOURCE_BRANCH_LINK_NAME
          : !destBranchPrefix
            ? DEST_BRANCH_PREFIX_LINK_NAME
            : FILEPATH_LINK_NAME;
      dispatch(
        notifyApp(createErrorNotification('GitOps link missing', `Missing Dashboard link with name: ${missingLink}`))
      );
      return;
    }

    setIsLoading(true);
    let uid = dashboard.uid;
    try {
      const result = await getBackendSrv().post(`/api/dashboards/uid/${uid}/gitops/createpr`, {
        sourceRepo,
        sourceBranch,
        destBranchPrefix,
        dashFilepath,
        dashboardJSON,
        commitMessage,
      });
      setPrDetails(result.details);
      setPrOpened(true);
    } catch (error) {
      dispatch(notifyApp(createErrorNotification('Error', 'Failed to create Pull Request. Please try again.')));
    } finally {
      setIsLoading(false);
    }
  };

  const onDoFinish = () => {
    setIsModalOpen(false);
    onSuccess();
  };

  return (
    <>
      {isModalOpen && (
        <Modal title="Open GitHub PR" isOpen={isModalOpen} onDismiss={closeModal}>
          <div className={styles.floatRight}>
            <FeatureBadge featureState={FeatureState.alpha} />
          </div>
          {prOpened ? (
            <div>
              <div className={styles.main}>
                <p>Pull Request successfully merged and closed.</p>
                {prDetails && (
                  <LinkButton
                    href={prDetails.prUrl}
                    target="_blank"
                    icon="external-link-alt"
                    variant="primary"
                  >
                    View PR #{prDetails.pr}
                  </LinkButton>
                )}
                <Button variant="secondary" onClick={onDoFinish} className={styles.leftPad}>
                  Close window
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.main}>Click below to create a Pull Request in GitHub.</div>
              <div>These steps will be completed on your behalf:</div>
              <div>
                <ul className={styles.list}>
                  <li>Your changes will be stored in this GitHub repo: {sourceRepo}</li>
                  <li>The current dashboard will be committed to a new branch with this prefix: {destBranchPrefix}</li>
                  <li>
                    A Pull Request will be created from the new branch to the <b>{sourceBranch}</b> branch.
                  </li>
                  <li>
                    The Pull Request will be merged with the <b>{sourceBranch}</b> branch and closed.
                  </li>
                </ul>
              </div>
              <Field label="Commit message:">
                <Input
                  placeholder="Optional message for the Git repo..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.currentTarget.value)}
                />
              </Field>
              <Button variant="primary" onClick={onCreatePR} disabled={isLoading}>
                {isLoading ? 'Creating PR...' : 'Create PR'}
              </Button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

const styles = {
  leftPad: css({
    marginLeft: '10px',
    display: 'inline-block',
  }),
  main: css({
    fontWeight: 'bold',
    marginTop: '20px',
    marginBottom: '20px',
  }),
  list: css({
    marginTop: '20px',
    marginBottom: '20px',
    marginLeft: '40px',
  }),
  prDetails: css({
    padding: '10px',
    marginBottom: '20px',
  }),
  floatRight: css({
    float: 'right',
  }),
};
