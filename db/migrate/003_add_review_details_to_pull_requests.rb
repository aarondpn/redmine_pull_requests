# frozen_string_literal: true

class AddReviewDetailsToPullRequests < ActiveRecord::Migration[6.1]
  def change
    change_table :pull_requests, bulk: true do |t|
      t.string :head_sha, limit: 64
      t.text :reviewers
      t.string :review_decision, limit: 30
      t.integer :comments_count
      t.integer :unresolved_threads_count
      t.string :checks_state, limit: 30
      t.integer :checks_count
      t.integer :checks_passed_count
      t.integer :checks_failed_count
      t.string :checks_url, limit: 1024
    end
    add_index :pull_requests, :head_sha
  end
end
