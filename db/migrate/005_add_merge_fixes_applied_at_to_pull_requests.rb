# frozen_string_literal: true

# Fixing keywords are applied once, on the merge event. Pull requests merged
# before this migration count as done.
class AddMergeFixesAppliedAtToPullRequests < ActiveRecord::Migration[6.1]
  def change
    add_column :pull_requests, :merge_fixes_applied_at, :datetime
    up_only do
      execute "UPDATE pull_requests SET merge_fixes_applied_at = COALESCE(merged_at, updated_at) WHERE state = 'merged'"
    end
  end
end
