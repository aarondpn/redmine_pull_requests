# frozen_string_literal: true

class CreateIssuePullRequests < ActiveRecord::Migration[6.1]
  def change
    create_table :issue_pull_requests do |t|
      t.integer :issue_id, null: false
      t.integer :pull_request_id, null: false
      t.integer :user_id
      t.string :source, null: false, default: 'manual', limit: 30
      t.datetime :created_at, null: false
    end
    add_index :issue_pull_requests, [:issue_id, :pull_request_id], unique: true
    add_index :issue_pull_requests, :pull_request_id
  end
end
