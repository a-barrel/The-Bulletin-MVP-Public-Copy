import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import ForumIcon from '@mui/icons-material/Forum';
import AddCommentIcon from '@mui/icons-material/AddComment';
import PropTypes from 'prop-types';
import FriendBadge from '../../components/FriendBadge';
import { resolveUserId } from './utils';

function CommentsSection({
  replyItems,
  replyCount,
  commentsLabel,
  isLoadingReplies,
  repliesError,
  hasReachedReplyLimit,
  isOffline,
  currentUserId,
  onOpenReport,
  onOpenComposer,
  isInteractionLocked
}) {
  return (
    <>
      <div className="comments-header">
        <ForumIcon className="comment-icon" aria-hidden="true" />
        <p>Comments ({commentsLabel})</p>
      </div>

      <div className="comments-section">
        {isLoadingReplies ? <div className="muted">Loading replies...</div> : null}
        {repliesError ? <div className="error-text">{repliesError}</div> : null}
        {!isLoadingReplies && !repliesError && replyCount === 0 ? (
          <div className="muted">No replies yet.</div>
        ) : null}
        {hasReachedReplyLimit ? <div className="muted">Reply limit reached for this discussion.</div> : null}

        {replyItems.map((reply) => {
          const { _id, authorName, message, createdLabel, profileLink, avatarUrl, author } = reply;
          const authorUserId =
            resolveUserId(author?._id) ||
            resolveUserId(author?.id) ||
            resolveUserId(author?.userId) ||
            resolveUserId(author?.uid) ||
            resolveUserId(author?.username) ||
            resolveUserId(author?.email);
          const content = (
            <>
              <img src={avatarUrl || undefined} className="commenter-pfp" alt={`${authorName} avatar`} />
              <span className="commenter-info">
                <strong>
                  {authorName}
                  <FriendBadge userId={authorUserId} size="0.9em" className="comment-friend-badge" />
                </strong>
                {createdLabel ? <span className="comment-timestamp">{createdLabel}</span> : null}
              </span>
            </>
          );
          return (
            <div className="comment" key={_id}>
              {profileLink ? (
                <Link to={profileLink.pathname} state={profileLink.state} className="comment-header user-link">
                  {content}
                </Link>
              ) : (
                <div className="comment-header">{content}</div>
              )}
              <div className="comment-body">
                <p>{message}</p>
                {reply.author._id !== currentUserId && (
                  <button
                    type="button"
                    className="comment-report-btn"
                    onClick={() => onOpenReport(reply)}
                    disabled={isOffline}
                    aria-label="Report this reply"
                    title={isOffline ? 'Reconnect to submit a report' : 'Report this reply'}
                  >
                    Report
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="create-comment"
        disabled={isOffline || isInteractionLocked || hasReachedReplyLimit}
        onClick={onOpenComposer}
        aria-label="Create reply"
        title={
          isOffline
            ? 'Reconnect to add a reply'
            : hasReachedReplyLimit
            ? 'Reply limit reached for this discussion'
            : 'Create reply'
        }
      >
        <AddCommentIcon aria-hidden="true" />
        <span>Create Comment</span>
      </button>
    </>
  );
}

CommentsSection.propTypes = {
  replyItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  replyCount: PropTypes.number.isRequired,
  commentsLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  isLoadingReplies: PropTypes.bool,
  repliesError: PropTypes.string,
  hasReachedReplyLimit: PropTypes.bool,
  isOffline: PropTypes.bool,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onOpenReport: PropTypes.func.isRequired,
  onOpenComposer: PropTypes.func.isRequired,
  isInteractionLocked: PropTypes.bool
};

CommentsSection.defaultProps = {
  isLoadingReplies: false,
  repliesError: null,
  hasReachedReplyLimit: false,
  isOffline: false,
  currentUserId: null,
  isInteractionLocked: false
};

export default memo(CommentsSection);
