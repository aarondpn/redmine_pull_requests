# frozen_string_literal: true

class CreatePullRequestProjectSettings < ActiveRecord::Migration[6.1]
  def change
    create_table :pull_request_project_settings do |t|
      t.integer :project_id, null: false
      t.text :repositories
      t.timestamps
    end
    add_index :pull_request_project_settings, :project_id, unique: true
  end
end
